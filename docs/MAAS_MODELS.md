# MaaS Model Evaluation

## Scope

This document records the configured Red Hat Demo Platform MaaS reasoning capability without exposing its endpoint or credentials.

The model endpoint is supplied through `CM_MAAS_BASE_URL` and is called as an OpenAI-compatible Chat Completions endpoint.

Credentials belong only in the ignored local `.env` file.

Required variable names are `CM_MAAS_BASE_URL`, `CM_MAAS_API_KEY`, `CM_MAAS_MODEL`, and `CM_MAAS_TIMEOUT_MS`.

One MaaS key can authorize multiple subscribed models.

Restricted-access models are unavailable to this application and are excluded from this benchmark.

The benchmark key has a $50 budget and a 30-day expiration.

## Portal-Declared Model Information

The following facts are portal-declared configuration information, not benchmark measurements.

| Model | Why Evaluate It | Context | Input Cost | Output Cost | Declared Capabilities |
|---|---|---:|---:|---:|---|
| `gpt-oss-120b` | Highest-capability general reasoning candidate for research planning and synthesis. | 32,768 | $0.15/M | $0.60/M | Chat, function calling, tool choice |
| `deepseek-r1-distill-qwen-14b` | Large-context reasoning candidate for long evidence sets and verification. | 500,000 | $0.80/M | $0.80/M | Chat, function calling |
| `llama-scout-17b` | Large-context, low-latency candidate for evidence review and verification. | 400,000 | $1.07/M | $1.07/M | Chat, function calling |
| `gpt-oss-20b` | Lower-cost candidate for bounded extraction, classification, and fallback work. | 32,768 | $0.08/M | $0.30/M | Chat, function calling, tool choice |

## Benchmark Method

Run `npm run probe:maas -- gpt-oss-120b` to validate the primary model first.

Run `npm run benchmark:maas` to run the same cases sequentially across all four authorized models.

The executable benchmark uses the same evidence-bound cases for every model: research planning, source-backed fact extraction, signal evaluation, and claim verification.

Each case requires a schema-valid function-call or JSON result and records latency plus provider-reported token usage when available.

The benchmark uses no account data, no customer data, and no secret values.

An individual case failure prevents a model from passing the benchmark.

## Experimentally Measured Results

The following results were measured on 2026-07-13 against the configured MaaS endpoint.

They are not portal declarations and are not evidence of production readiness.

### Isolated Primary Probe

`gpt-oss-120b` passed all four cases after compatible legacy function-call parsing was added.

Measured totals were 999 input tokens, 1,239 output tokens, and an estimated $0.000893 cost.

Case latency ranged from 1,640 ms to 7,987 ms.

### Sequential Multi-Model Benchmark

| Model | Result | Measured Latency | Provider Usage | Estimated Cost | Observed Limitation |
|---|---|---:|---:|---:|---|
| `gpt-oss-120b` | 2 of 4 cases passed | 16,099 ms total | 519 input, 376 output tokens from successful cases | $0.000303 | Planning and signal evaluation returned no parseable structured result in this run. |
| `deepseek-r1-distill-qwen-14b` | 0 of 4 cases passed | 34,071 ms total | Not returned | Not calculable | All cases returned non-JSON content despite the required structured result. |
| `llama-scout-17b` | 3 of 4 cases passed | 3,603 ms total | 1,354 input, 171 output tokens | $0.001632 | Planning returned an array where the required tool schema expected one object. |
| `gpt-oss-20b` | 3 of 4 cases passed | 12,094 ms total | 824 input, 907 output tokens from successful cases | $0.000338 | Planning received HTTP 429. |

Usage and cost totals exclude failed calls where the provider did not return usage metadata.

## Recommendation

No model is production-qualified for autonomous research yet.

`gpt-oss-120b` is the provisional primary candidate because it passed the isolated full probe and has the lowest declared cost among the high-capability options, but it needs repeatability testing and a validated retry policy before promotion.

`llama-scout-17b` is the provisional verifier candidate because it completed three cases with the lowest measured latency, but its planning output requires strict response-shape investigation before use.

`gpt-oss-20b` is the provisional fallback candidate for bounded tasks because it completed three cases at the lowest declared price, but it requires rate-limit handling and a repeatable planning result.

`deepseek-r1-distill-qwen-14b` is excluded from the current structured-output path until its non-JSON responses can be explained and corrected without weakening schema validation.

## Known Limitations

The configured endpoint has been validated only through Chat Completions requests using the local API key.

The benchmark observed no model catalog discovery and does not rely on a MaaS management API.

Context windows and per-token prices are portal-declared rather than experimentally verified limits.

The $50, 30-day key budget is an operating constraint, not a measured quota ceiling.

Structured-output reliability is not yet sufficient to start autonomous research without a model-specific retry, parsing, and validation policy.

The benchmark does not test live web search, retrieval, browser rendering, account resolution, or complete Account Signal Brief generation.
