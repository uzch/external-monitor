# Backstory MCP Capability Evaluation — Live Test Results

> Evaluated 2026-07-19 against the live People.ai/Backstory MCP server.
> No external research used. All findings from direct schema inspection and tool calls.

---

## 1. Tool Inventory (VERIFIED — from live MCP schema)

| # | Tool | Purpose | Required Inputs | Optional Inputs | Filters | Multi-Account | Pagination |
|---|---|---|---|---|---|---|---|
| 1 | `find_account` | Fuzzy name search | `account_name: string` | None | None | No | No |
| 2 | `find_record_by_crm_id` | CRM ID lookup | `crm_id: string` | None | None | No | No |
| 3 | `top_records` | User-profile-relevant accounts | None | None | Implicit (user role) | Returns up to 20 | No |
| 4 | `get_account_status` | Risks / next steps / topics | `peopleai_account_id: int` | None | Fixed 30-day window | No | No |
| 5 | `get_recent_account_activity` | Summarized comms history | `peopleai_account_id: int` | None | Fixed 30-day window | No | No |
| 6 | `account_company_news` | Public filings & news | `peopleai_account_id: int` | None | Public companies only | No | No |
| 7 | `ask_sales_ai_about_account` | Free-form AI analysis | `question: string`, `peopleai_account_id: int` | None | None | No | No |
| 8 | `get_opportunity_status` | Opp risks / next steps / topics | `peopleai_opportunity_id: int` | None | Fixed 30-day window | No | No |
| 9 | `get_recent_opportunity_activity` | Opp comms history | `peopleai_opportunity_id: int` | None | Fixed 30-day window | No | No |
| 10 | `ask_sales_ai_about_opportunity` | Free-form AI opp analysis | `question: string`, `peopleai_opportunity_id: int` | None | None | No | No |
| 11 | `situation_search` | Historical deal pattern matching | `query: string`, `opportunity_id: int` | None | 70% similarity threshold | No | No |

**Structural facts (VERIFIED):**

- Zero tools expose optional parameters of any kind.
- Every intelligence tool takes exactly one integer ID. None accept arrays.
- No tool exposes GEO, region, pod, territory, or owner as a parameter.
- No tool accepts pagination, time-window override, or result-count parameters.
- `top_records` is the only tool that returns multiple accounts. It takes no parameters and is capped at 20.
- `find_account` is a fuzzy string match on account name only.

---

## 2. Portfolio Retrieval Tests (VERIFIED)

| Request | Succeeded? | Tool Used | Inputs | Accounts Returned | Complete? | Pagination? | Notes |
|---|---|---|---|---|---|---|---|
| "All accounts in NAPS GEO" | **No** | `find_account` | `"NAPS"` | 1 (unrelated) | No | No | Treated as fuzzy name search. Returned a name containing similar characters — not a GEO filter. |
| "All accounts in Mid-Atlantic region" | **Not testable** | — | — | — | — | — | No tool accepts region as input. |
| "All accounts in Federal Civilian pod" | **Not testable** | — | — | — | — | — | No tool accepts pod as input. |
| "All accounts in SLED East territory" | **Not testable** | — | — | — | — | — | No tool accepts territory as input. |
| "All accounts owned by current user" | **Partial** | `top_records` | None | 20 | **Unknown** | No | Returns "most relevant" accounts for user profile. No way to confirm completeness or request more. Not necessarily ownership-filtered. |
| "GEO=NAPS, region=Federal, territory=Civilian" | **No** | — | — | — | — | — | No tool supports compound filters. |

**Fields returned by `top_records` (VERIFIED):** `peopleai_account_id`, `name`, `domain`, and an `opportunities[]` array containing: `peopleai_opportunity_id`, `opportunity_name`, `amount`, `close_date`, `engagement_level`, `owner.id`, `owner.name`, `type`.

**Key finding:** There is no way to retrieve an authoritative, filterable, paginated account list from the MCP. `top_records` is a fixed relevance-ranked view capped at 20 with no filtering or paging parameters.

---

## 3. Cross-Account Intelligence Tests (VERIFIED)

| Request | One portfolio call? | Multi-ID call? | Batch input? | NL query across accounts? | Claude loop? | Not possible? |
|---|---|---|---|---|---|---|
| "Which accounts had meaningful activity in 30 days?" | No | No | No | No | **Yes** (call `get_account_status` or `get_recent_account_activity` per account) | — |
| "Which accounts show highest risk?" | No | No | No | No | **Yes** (call `get_account_status` per account, compare risks) | — |
| "Active opps but weak engagement?" | No | No | No | No | **Yes** (use `top_records` engagement_level + `get_account_status`) | — |
| "Common products/blockers across accounts?" | No | No | No | No | **Yes** (call `get_account_status` per account, synthesize) | — |
| "Compare status of three accounts" | No | No | No | No | **Yes** (call `get_account_status` x3, compare) | — |
| "Which accounts to review first?" | No | No | No | No | **Yes** (call `get_account_status` per account, rank) | — |
| "Major themes across portfolio" | No | No | No | No | **Yes** (call `get_account_status` per account, synthesize) | — |

**Conclusion (VERIFIED):** The MCP has **zero native cross-account intelligence**. Every cross-account question requires Claude to loop through single-account tool calls and synthesize the results.

---

## 4. Multi-Account Input Support (VERIFIED)

| Input Type | Supported by Any Tool? | Evidence |
|---|---|---|
| Array of account IDs | **No** | All ID params are `integer`, not `array`. |
| Array of account names | **No** | `find_account` takes a single `string`. |
| GEO / region / pod / territory filter | **No** | No tool exposes these params. `find_account("NAPS")` returns unrelated fuzzy match. |
| Owner filter | **No** | `top_records` may implicitly filter by user role but exposes no owner param. |
| Free-form portfolio question | **No** | `ask_sales_ai_about_account` requires a single account ID. |
| Query returning scope + intelligence | **No** | Discovery and intelligence are separate tools. |
| Pagination parameters | **No** | Zero tools expose offset, cursor, page, or limit params. |
| Requested result count | **No** | No count/limit param on any tool. |
| Time-window parameter | **No** | All activity tools use a fixed 30-day window. Not configurable. |

---

## 5. Intelligence Depth Comparison (VERIFIED)

| Level | Tool | Single/Multi | Time Window | Observed Output Size | Suitable for Full Portfolio? | Reserve for Shortlist? |
|---|---|---|---|---|---|---|
| **Metadata + opps** | `top_records` | Multi (up to 20) | N/A | ~15-20 KB total for 20 accounts | Yes (one call) | No |
| **Metadata + opps** | `find_account` | Single | N/A | ~0.5 KB per account | Yes (if names known) | No |
| **Strategic status** | `get_account_status` | Single | 30 days | ~1.5 KB per account | **Feasible** — moderate cost | No |
| **Opp-level status** | `get_opportunity_status` | Single | 30 days | ~1.5 KB per opportunity | Feasible for shortlisted opps | Preferred |
| **Full comms history** | `get_recent_account_activity` | Single | 30 days | **~160 KB per account** | **No** — will overwhelm context | **Yes** |
| **Public news/filings** | `account_company_news` | Single | Historical | ~25 KB per account | No — public companies only, large output | **Yes** |
| **Deep AI analysis** | `ask_sales_ai_about_account` | Single | All available data | ~1 KB per question | Feasible but involves server-side AI | **Yes** |
| **Opp comms history** | `get_recent_opportunity_activity` | Single | 30 days | ~160 KB (inferred) | **No** | **Yes** |
| **Deep AI opp analysis** | `ask_sales_ai_about_opportunity` | Single | All available data | ~1 KB per question | Feasible but costly | **Yes** |
| **Historical pattern match** | `situation_search` | Single opp | Historical | Variable (up to 4 cases) | No — opp-specific | **Yes** |

---

## 6. Capability Matrix

| Capability | Example Request | Tool | Native Support? | How It Works | Limits / Unknowns |
|---|---|---|---|---|---|
| Find account by name | "Find the Acme account" | `find_account` | **Yes** | Fuzzy string match on name | Single name only, may return unexpected matches |
| Find by CRM ID | "Look up SF-001234" | `find_record_by_crm_id` | **Yes** | Exact CRM ID match | Single ID only |
| Browse my accounts | "Show me my accounts" | `top_records` | **Partial** | Returns up to 20 relevance-ranked | Cap at 20, no filters, no paging, completeness unknown |
| Filter by GEO/region/territory | "NAPS Federal Civilian" | None | **No** | Not available | No filter params on any tool |
| Account strategic status | "How is this account?" | `get_account_status` | **Yes** | 30-day comms analysis: risks, topics, next steps | Single account, fixed window |
| Account comms detail | "What have we discussed?" | `get_recent_account_activity` | **Yes** | Full 30-day email/meeting summaries | Single account, ~160 KB output |
| Public company news | "Any news on this company?" | `account_company_news` | **Yes** | Earnings calls, 8-K filings | Public companies only |
| Deep AI account analysis | "Analyze this account" | `ask_sales_ai_about_account` | **Yes** | Server-side AI with full context | Single account per call |
| Opportunity status | "How is this deal?" | `get_opportunity_status` | **Yes** | 30-day comms: risks, topics, next steps | Single opp |
| Opp comms detail | "What's happened on this deal?" | `get_recent_opportunity_activity` | **Yes** | Full 30-day email/meeting summaries | Single opp, heavy output |
| Deep AI opp analysis | "What's the win strategy?" | `ask_sales_ai_about_opportunity` | **Yes** | Server-side AI with full context | Single opp per call |
| Historical deal patterns | "How did we handle this before?" | `situation_search` | **Yes** | Finds similar past deals by challenge description | Single opp, up to 4 matches above 70% |
| Cross-account analysis | "Compare these 5 accounts" | None | **No** | Claude must loop `get_account_status` per account | N/A |
| Portfolio-level question | "Themes across my territory" | None | **No** | Claude must loop + synthesize | N/A |
| Custom time window | "Last 7 days of activity" | None | **No** | All tools fixed at 30 days | N/A |
| Paginated account list | "Show me the next 20" | None | **No** | `top_records` returns one fixed page | N/A |

---

## 7. Answers to Key Questions

### 1. Can the live MCP retrieve an authoritative account list for a GEO, region, pod, territory, or owner?

**VERIFIED: No.** No tool accepts GEO, region, pod, territory, or owner as input. `top_records` returns up to 20 accounts based on an opaque user-profile relevance ranking with no filtering or pagination. `find_account` is a fuzzy name search, not a filter. An authoritative account list must come from an external source (CRM export, Salesforce API, static config, etc.).

### 2. Can it analyze multiple accounts in one call?

**VERIFIED: No.** Every intelligence tool (`get_account_status`, `get_recent_account_activity`, `ask_sales_ai_about_account`) takes a single `peopleai_account_id: integer`. No array, batch, or multi-ID input is supported.

### 3. Can it answer a natural-language question across multiple accounts?

**VERIFIED: No.** `ask_sales_ai_about_account` requires a single account ID. There is no portfolio-level or multi-account NL query tool. Claude must call per-account and synthesize.

### 4. Which results require Claude to loop through individual accounts?

**VERIFIED: All cross-account intelligence.** Any question involving comparison, ranking, filtering, or synthesis across accounts requires Claude to:

1. Obtain an account list (from `top_records`, an external source, or user input)
2. Call a single-account tool per account
3. Synthesize the results

### 5. What lightweight internal context could reasonably be collected for an entire portfolio?

**VERIFIED:**

- **`top_records`** — one call, ~15-20 KB, returns metadata + opportunities for up to 20 accounts. Includes `engagement_level` per opportunity, which is a useful lightweight signal.
- **`get_account_status`** — ~1.5 KB per account. Contains risks, topics, next steps. Feasible for 20-30 accounts in a single orchestration pass without overwhelming context.

**INFERRED:** `get_account_status` is the sweet spot for portfolio-wide collection. At ~1.5 KB/account, 30 accounts would produce ~45 KB — manageable in one synthesis pass.

### 6. Which deeper tools should be reserved for shortlisted accounts?

**VERIFIED:**

- **`get_recent_account_activity`** — ~160 KB per account. Must be reserved for individual deep-dives. Would consume an entire agent context for a single account.
- **`account_company_news`** — ~25 KB per public company. Reserve for shortlisted public accounts.
- **`ask_sales_ai_about_account`** — compact output (~1 KB) but invokes server-side AI. Suitable for targeted questions on shortlisted accounts.
- **`get_recent_opportunity_activity`** — heavy (inferred ~160 KB). Reserve for shortlisted opportunities.
- **`ask_sales_ai_about_opportunity`** / **`situation_search`** — opportunity-specific deep tools. Reserve for shortlisted deals.

### 7. What is the most computationally efficient workflow supported by the live MCP?

**VERIFIED:**

```
Step 1: top_records → get metadata + engagement_level for up to 20 accounts (1 call)
Step 2: get_account_status per account → risks/topics/next steps (~1.5 KB each, parallelizable)
Step 3: Claude synthesizes across all status results → ranking, themes, shortlist
Step 4: For shortlisted accounts only → get_recent_account_activity, ask_sales_ai, news
```

This is a **two-tier fan-out**: cheap + broad first, expensive + deep only on the shortlist. `top_records` engagement scores can further pre-filter before Step 2.

### 8. Which capabilities remain UNKNOWN and should be confirmed with People.ai?

| Unknown | Why It Matters |
|---|---|
| **Completeness of `top_records`** | Does it return ALL user-associated accounts or only a ranked subset? Can accounts fall off the list? |
| **Ranking/filtering logic in `top_records`** | What determines "most relevant"? Is it configurable per user or org? |
| **Whether a bulk/batch API exists outside MCP** | The MCP may expose only a subset of the People.ai API. A REST API may support array inputs, filters, or pagination. |
| **Whether GEO/region/territory fields exist in the data model** | These fields may exist in People.ai but simply not be exposed via MCP tools. |
| **Rate limits or throttling** | Can 30+ parallel `get_account_status` calls run without throttling? |
| **Whether `ask_sales_ai` has per-session or per-minute limits** | Server-side AI calls may have usage caps. |
| **Time window configurability** | The 30-day window is documented as fixed. Is there an undocumented override? |
| **Whether custom profile configurations affect `top_records` scope** | The docs mention "custom profile configuration" — what controls this? |
| **Maximum opportunities returned per account** | Test data showed 5 per account. Is this capped or coincidental? |
| **Whether `find_account` supports wildcards or partial match syntax** | Only tested with "NAPS" — behavior with other patterns is unknown. |

---

## Classification Summary

| Category | Items |
|---|---|
| **VERIFIED** | All 11 tool schemas and their exact input signatures; absence of array/filter/pagination params; `top_records` returns up to 20 accounts with no filters; `find_account` is fuzzy name search only; `get_account_status` ~1.5 KB output; `get_recent_account_activity` ~160 KB output; `account_company_news` ~25 KB output; `ask_sales_ai_about_account` ~1 KB output; no native cross-account intelligence; no GEO/region/territory filtering; fixed 30-day window on activity tools |
| **INFERRED** | `get_recent_opportunity_activity` is comparably heavy to account activity (~160 KB); `top_records` max of 5 opportunities per account may be a cap; `ask_sales_ai` tools involve server-side AI processing with potential rate limits |
| **UNKNOWN** | Completeness of `top_records`; whether People.ai REST API offers capabilities not exposed via MCP; rate limits; GEO/region fields in data model; time window configurability; `top_records` profile configuration options; opportunity count caps |

---

**Bottom line for workflow design:** The MCP is a single-account intelligence API with no portfolio-level capabilities. Any cross-account workflow requires Claude to supply the account list externally and orchestrate individual calls. The efficient path is `top_records` (free metadata) + `get_account_status` (cheap per-account, ~1.5 KB) for broad coverage, reserving the ~160 KB activity tools and AI analysis for a shortlist.
