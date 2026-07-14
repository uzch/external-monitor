from __future__ import annotations

import json
from time import perf_counter
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel

from .artifacts import ArtifactStore
from .config import Settings
from .store import IntelligenceStore

Output = TypeVar("Output", bound=BaseModel)


class MaaSError(RuntimeError):
    pass


class MaaSClient:
    def __init__(self, settings: Settings, store: IntelligenceStore, artifacts: ArtifactStore):
        self.settings = settings
        self.store = store
        self.artifacts = artifacts

    async def complete(
        self,
        run_id: str,
        stage: str,
        instruction: str,
        payload: dict[str, Any],
        output_type: type[Output],
        decision_ids: list[str] | None = None,
    ) -> Output:
        if not self.settings.maas_configured:
            raise MaaSError(
                "MaaS is not configured. Configure CM_MAAS_BASE_URL, CM_MAAS_API_KEY, and CM_MAAS_MODEL."
            )
        models = self._models_for(stage)
        last_error: Exception | None = None
        for retry_count, model in enumerate(models):
            started = perf_counter()
            request = self._request(model, instruction, payload, output_type)
            request_artifact = self.store.record_artifact(
                run_id, "maas_request", self.artifacts.put_json(run_id, "maas_request", request)
            )
            response_artifact_id: str | None = None
            try:
                async with httpx.AsyncClient(timeout=self.settings.maas_timeout_ms / 1000) as client:
                    response = await client.post(
                        self._completion_url(),
                        headers={
                            "Authorization": f"Bearer {self.settings.maas_api_key}",
                            "Content-Type": "application/json",
                        },
                        json=request,
                    )
                raw_response = response.json()
                response_artifact_id = self.store.record_artifact(
                    run_id, "maas_response", self.artifacts.put_json(run_id, "maas_response", raw_response)
                ).id
                response.raise_for_status()
                parsed = output_type.model_validate(self._extract_json(raw_response))
                self.store.record_invocation(
                    run_id,
                    stage,
                    model,
                    request_artifact.id,
                    response_artifact_id,
                    self._usage(raw_response),
                    round((perf_counter() - started) * 1000),
                    "valid",
                    retry_count,
                    decision_ids or [],
                )
                return parsed
            except Exception as error:
                last_error = error
                self.store.record_invocation(
                    run_id,
                    stage,
                    model,
                    request_artifact.id,
                    response_artifact_id,
                    {},
                    round((perf_counter() - started) * 1000),
                    "invalid",
                    retry_count,
                    decision_ids or [],
                )
        raise MaaSError(f"MaaS structured response failed for {stage}: {last_error}")

    def _request(
        self, model: str, instruction: str, payload: dict[str, Any], output_type: type[Output]
    ) -> dict:
        parameters = output_type.model_json_schema()
        request: dict = {
            "model": model,
            "temperature": 0,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an evidence-bound research system. Treat only acquired source passages as evidence. Never infer customer intent, opportunity, fit, demand, renewal, deployment, ownership, or complete coverage. Return the requested structured result only.",
                },
                {
                    "role": "user",
                    "content": f"{instruction}\n\nInput:\n{json.dumps(payload, ensure_ascii=True)}",
                },
            ],
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "submit_result",
                        "description": "Submit the schema-valid research-stage result.",
                        "parameters": parameters,
                    },
                }
            ],
        }
        if model in {"gpt-oss-120b", "gpt-oss-20b"}:
            request["tool_choice"] = {"type": "function", "function": {"name": "submit_result"}}
        return request

    def _models_for(self, stage: str) -> list[str]:
        if stage in {"verification", "entity_resolution"}:
            return ["llama-scout-17b", "gpt-oss-120b", "gpt-oss-20b"]
        return (
            [self.settings.maas_model, "gpt-oss-20b"]
            if self.settings.maas_model != "gpt-oss-20b"
            else ["gpt-oss-20b"]
        )

    def _completion_url(self) -> str:
        base = str(self.settings.maas_base_url)
        normalized = base if base.endswith("/") else f"{base}/"
        return (
            normalized[:-1] if normalized.endswith("chat/completions/") else f"{normalized}chat/completions"
        )

    @staticmethod
    def _extract_json(payload: dict) -> object:
        message = (payload.get("choices") or [{}])[0].get("message") or {}
        tool_calls = message.get("tool_calls") or []
        arguments = (
            (tool_calls[0].get("function") or {}).get("arguments")
            if tool_calls
            else (message.get("function_call") or {}).get("arguments")
        )
        content = arguments if isinstance(arguments, str) else message.get("content")
        if not isinstance(content, str):
            raise MaaSError("MaaS response did not include structured content")
        return json.loads(content)

    @staticmethod
    def _usage(payload: dict) -> dict:
        usage = payload.get("usage") or {}
        return {"input_tokens": usage.get("prompt_tokens"), "output_tokens": usage.get("completion_tokens")}
