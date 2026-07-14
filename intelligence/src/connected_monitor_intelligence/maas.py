from __future__ import annotations

import asyncio
import json
from time import perf_counter
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from .artifacts import ArtifactStore
from .config import Settings
from .store import IntelligenceStore

Output = TypeVar("Output", bound=BaseModel)
_REQUEST_LOCK = asyncio.Lock()
_last_request_finished_at = 0.0


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
            raw_response: dict[str, Any] = {}
            try:
                response = await self._post(request)
                try:
                    raw_response = response.json()
                except ValueError:
                    raw_response = {"status_code": response.status_code, "parseable_json": False}
                response_artifact_id = self.store.record_artifact(
                    run_id, "maas_response", self.artifacts.put_json(run_id, "maas_response", raw_response)
                ).id
                response.raise_for_status()
                wire_output = self._extract_json(raw_response)
                parsed = output_type.model_validate(self._normalize_wire_output(output_type, wire_output))
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
                last_error = MaaSError(self._safe_error(error))
                self.store.record_invocation(
                    run_id,
                    stage,
                    model,
                    request_artifact.id,
                    response_artifact_id,
                    self._usage(raw_response),
                    round((perf_counter() - started) * 1000),
                    "invalid",
                    retry_count,
                    decision_ids or [],
                )
        raise MaaSError(f"MaaS structured response failed for {stage}: {last_error}")

    async def _post(self, request: dict) -> httpx.Response:
        global _last_request_finished_at
        async with _REQUEST_LOCK:
            elapsed_ms = (perf_counter() - _last_request_finished_at) * 1000
            wait_ms = self.settings.maas_min_interval_ms - elapsed_ms
            if wait_ms > 0:
                await asyncio.sleep(wait_ms / 1000)
            try:
                async with httpx.AsyncClient(timeout=self.settings.maas_timeout_ms / 1000) as client:
                    return await client.post(
                        self._completion_url(),
                        headers={
                            "Authorization": f"Bearer {self.settings.maas_api_key}",
                            "Content-Type": "application/json",
                        },
                        json=request,
                    )
            finally:
                _last_request_finished_at = perf_counter()

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
        if isinstance(arguments, dict | list):
            return arguments
        content = arguments if isinstance(arguments, str) else message.get("content")
        if isinstance(content, dict):
            return content
        if isinstance(content, list):
            content = "".join(
                item.get("text", "") for item in content if isinstance(item, dict)
            )
        if not isinstance(content, str):
            raise MaaSError("MaaS response did not include structured content")
        candidate = content.strip()
        if candidate.startswith("```") and candidate.endswith("```"):
            candidate = candidate[3:-3].strip()
            if candidate.startswith("json"):
                candidate = candidate[4:].lstrip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            object_start = candidate.find("{")
            if object_start < 0:
                raise
            parsed, _ = json.JSONDecoder().raw_decode(candidate[object_start:])
            return parsed

    @staticmethod
    def _normalize_wire_output(output_type: type[Output], value: object) -> object:
        if output_type.__name__ != "FactExtraction" or not isinstance(value, dict):
            return value
        facts = value.get("facts")
        if not isinstance(facts, list):
            return value
        normalized: list[dict[str, str]] = []
        for item in facts:
            if not isinstance(item, dict):
                continue
            external_fact = item.get("external_fact") or item.get("fact")
            excerpt = item.get("supporting_excerpt") or item.get("excerpt")
            uncertainty = item.get("uncertainty") or item.get("limitation")
            if not isinstance(external_fact, str) or not isinstance(excerpt, str):
                continue
            normalized.append(
                {
                    "external_fact": external_fact,
                    "supporting_excerpt": excerpt,
                    "uncertainty": uncertainty
                    if isinstance(uncertainty, str) and uncertainty.strip()
                    else "The quoted source passage supports only this bounded external fact.",
                }
            )
            if len(normalized) == 3:
                break
        return {"facts": normalized}

    @staticmethod
    def _safe_error(error: Exception) -> str:
        if isinstance(error, httpx.HTTPStatusError):
            return f"Provider returned HTTP {error.response.status_code}."
        if isinstance(error, httpx.RequestError):
            return f"Provider request failed with {type(error).__name__}."
        if isinstance(error, ValidationError):
            summaries = [
                f"{'.'.join(str(part) for part in item['loc'])}: {item['type']}"
                for item in error.errors()[:5]
            ]
            return "Structured response validation failed: " + "; ".join(summaries)
        if isinstance(error, json.JSONDecodeError):
            return "Provider response did not contain valid JSON."
        if isinstance(error, MaaSError):
            return str(error)[:500]
        return f"Provider response failed with {type(error).__name__}."

    @staticmethod
    def _usage(payload: dict) -> dict:
        usage = payload.get("usage") or {}
        return {"input_tokens": usage.get("prompt_tokens"), "output_tokens": usage.get("completion_tokens")}
