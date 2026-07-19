# Backstory MCP Tools Reference

> MCP server for the **People.ai SalesAI** platform.

---

## Table of Contents

1. [Account Lookup](#1-account-lookup)
   - [find_account](#find_account)
   - [find_record_by_crm_id](#find_record_by_crm_id)
   - [top_records](#top_records)
2. [Account Intelligence](#2-account-intelligence)
   - [get_account_status](#get_account_status)
   - [get_recent_account_activity](#get_recent_account_activity)
   - [account_company_news](#account_company_news)
   - [ask_sales_ai_about_account](#ask_sales_ai_about_account)
3. [Opportunity Intelligence](#3-opportunity-intelligence)
   - [get_opportunity_status](#get_opportunity_status)
   - [get_recent_opportunity_activity](#get_recent_opportunity_activity)
   - [ask_sales_ai_about_opportunity](#ask_sales_ai_about_opportunity)
4. [Deal Analysis](#4-deal-analysis)
   - [situation_search](#situation_search)

---

## 1. Account Lookup

Tools for finding and identifying accounts and opportunities within the CRM system.

---

### `find_account`

**Full name:** `mcp__backstory__find_account`

**Description:**
Finds account information by searching for the account name in the CRM system. Returns essential details including the People.ai account ID, which is required for all other account-specific tools (activities, summaries, news, status, etc.).

**Parameters:**

| Name           | Type   | Required | Description                                              |
|----------------|--------|----------|----------------------------------------------------------|
| `account_name` | string | Yes      | Name of the account to find (e.g., "Red Hat", "Microsoft"). |

**Returns:**
Account details including People.ai account ID, domain, name, and associated opportunities.

**Use Cases:**
- First step when a user mentions an account by name — resolves the name to a `peopleai_account_id` needed by all downstream tools.
- Discovering which opportunities exist under a given account.

**Notes:**
- Before using any opportunity-specific tools, show the list of opportunities to the user and let them choose.
- Use the returned `peopleai_account_id` to call downstream tools.

---

### `find_record_by_crm_id`

**Full name:** `mcp__backstory__find_record_by_crm_id`

**Description:**
Looks up an account or opportunity using a CRM ID (e.g., Salesforce ID). Returns the internal People.ai IDs (`peopleai_account_id`, `peopleai_opportunity_id`) needed for all other tools.

**Parameters:**

| Name     | Type   | Required | Description                                                    |
|----------|--------|----------|----------------------------------------------------------------|
| `crm_id` | string | Yes      | The CRM ID (e.g., Salesforce ID) for an account or opportunity. |

**Returns:**
Internal People.ai IDs for the matched record.

**Use Cases:**
- When the user provides a Salesforce ID or other CRM identifier instead of an account name.
- Resolving external system IDs to People.ai internal IDs.

**Notes:**
- Always call this tool first when the user provides a CRM ID.

---

### `top_records`

**Full name:** `mcp__backstory__top_records`

**Description:**
Retrieves the most relevant accounts and opportunities for the current user's profile. Returns top active accounts and opportunities based on the user's role or custom profile configuration. This is not an exhaustive list — it surfaces the most relevant records.

**Parameters:**
None.

**Returns:**
An array of up to 20 accounts with their open opportunities.

**Use Cases:**
- When the user does not specify a particular account name or CRM ID — present a summary and ask for further specification.
- As a fallback when `find_account` doesn't find a match — check the response for possible misspellings.

**Notes:**
- Do not call this tool more than once per interaction.
- Do not automatically loop through all returned records calling other tools — wait for the user to select specific records.
- Before using any account-specific tools, show the list to the user and let them choose.

---

## 2. Account Intelligence

Tools for understanding account health, recent communications, news, and strategic insights.

---

### `get_account_status`

**Full name:** `mcp__backstory__get_account_status`

**Description:**
Provides a strategic overview of the account with AI-analyzed risks, next steps, and key discussion topics. Analyzes the last 30 days of communication data and categorizes insights into:

- **Risks:** Potential issues or concerns detected in conversations.
- **Next Steps:** Agreed-upon actions and commitments.
- **Topics:** Key themes and subjects being discussed.

**Parameters:**

| Name                 | Type    | Required | Description                                      |
|----------------------|---------|----------|--------------------------------------------------|
| `peopleai_account_id`| integer | Yes      | People.ai account ID (obtain via `find_account` or `find_record_by_crm_id`). |

**Returns:**
Organized summary showing risks, next steps, and trending topics from recent communications.

**Use Cases:**
- Default tool for general questions about an account (e.g., "How's the Red Hat account going?").
- Quick strategic health check before a meeting or QBR.
- Identifying potential churn risks or stalled engagement.

**Notes:**
- This is the **default** tool for general account questions.
- Use other tools only when the user explicitly asks for recent activity, detailed analysis, or company news.

---

### `get_recent_account_activity`

**Full name:** `mcp__backstory__get_recent_account_activity`

**Description:**
Retrieves the last 30 days of communication activity between your team and the account. Includes summarized emails and meeting transcripts with key facts extracted and classified by importance (strategic, tactical, high-risk). Noise and small talk are filtered out to highlight revenue-relevant discussions and potential risks.

**Parameters:**

| Name                 | Type    | Required | Description                                      |
|----------------------|---------|----------|--------------------------------------------------|
| `peopleai_account_id`| integer | Yes      | People.ai account ID (obtain via `find_account` or `find_record_by_crm_id`). |

**Returns:**
Formatted summary of recent activity with extracted facts, risk indicators, and strategic insights from the last 30 days.

**Use Cases:**
- When the user asks specifically about recent activity or communications (e.g., "What have we been talking to Microsoft about lately?").
- Preparing for account reviews by understanding recent engagement patterns.
- Investigating specific interactions or commitments made in the last month.

**Notes:**
- Use only when the user asks specifically about recent activity or communications.
- Do not use for general account questions — use `get_account_status` instead.

---

### `account_company_news`

**Full name:** `mcp__backstory__account_company_news`

**Description:**
Retrieves recent company news and events for **publicly traded companies only**. Monitors public filings (e.g., 8-K, earnings calls) and news across:

- Mergers and Acquisitions
- Organizational Changes and Layoffs
- Vision and Strategy
- Financial Performance
- Executive Hires and Departures
- Other significant corporate events

**Parameters:**

| Name                 | Type    | Required | Description                                      |
|----------------------|---------|----------|--------------------------------------------------|
| `peopleai_account_id`| integer | Yes      | People.ai account ID for a publicly traded company. |

**Returns:**
Categorized recent news and public filings. Returns an empty list if the company is private or not publicly traded.

**Use Cases:**
- When the user asks about news or filings for a specific account (e.g., "Any recent news about Salesforce?").
- Staying informed about developments that may create sales opportunities or risks.
- Tracking executive changes, M&A activity, or earnings that could affect deal strategy.

**Notes:**
- Only use for **publicly traded companies**. Most CRM accounts are private and will not have data.
- Use only when the user asks specifically about news or filings.
- Do not use for general account questions.

---

### `ask_sales_ai_about_account`

**Full name:** `mcp__backstory__ask_sales_ai_about_account`

**Description:**
Consults the SalesAI assistant about a specific account using full account intelligence. SalesAI has access to:

- CRM data
- Last 30 days of communications
- Account scorecards
- Stakeholder information
- Public company filings

**Parameters:**

| Name                 | Type    | Required | Description                                      |
|----------------------|---------|----------|--------------------------------------------------|
| `question`           | string  | Yes      | The user's sales or account question. Pass it exactly as received. |
| `peopleai_account_id`| integer | Yes      | People.ai account ID (obtain via `find_account` or `find_record_by_crm_id`). |

**Returns:**
SalesAI's expert analysis based on comprehensive account data.

**Use Cases:**
- When the user explicitly asks for detailed analysis or expert insights about an account (e.g., "Give me a deep analysis of the Microsoft account").
- Complex strategic questions that require cross-referencing multiple data sources.
- Stakeholder mapping or relationship analysis.

**Notes:**
- Use only when the user explicitly asks for detailed analysis or expert insights.
- Do not use for general account questions — use `get_account_status` instead.
- Pass the user's question exactly as received.

---

## 3. Opportunity Intelligence

Tools for understanding opportunity health, recent communications, and strategic insights at the deal level.

---

### `get_opportunity_status`

**Full name:** `mcp__backstory__get_opportunity_status`

**Description:**
Provides a strategic overview of the opportunity with AI-analyzed risks, next steps, and key topics. Analyzes the last 30 days of communication data and categorizes insights into:

- **Risks:** Potential issues or concerns identified in conversations.
- **Next Steps:** Agreed-upon actions and commitments with the customer.
- **Topics:** Key themes and subjects being discussed.

**Parameters:**

| Name                     | Type    | Required | Description                                      |
|--------------------------|---------|----------|--------------------------------------------------|
| `peopleai_opportunity_id`| integer | Yes      | People.ai opportunity ID (obtain via `find_account` or `find_record_by_crm_id`). |

**Returns:**
Organized summary showing current risks, committed next steps, and trending discussion topics from recent communications.

**Use Cases:**
- Default tool for general questions about an opportunity (e.g., "How's the Red Hat ELA renewal going?").
- Quick deal health check before a forecast call or pipeline review.
- Identifying deal risks or stalled momentum.

**Notes:**
- This is the **default** tool for general opportunity questions.
- Use other tools only when the user explicitly asks for recent activity, detailed analysis, or company news.

---

### `get_recent_opportunity_activity`

**Full name:** `mcp__backstory__get_recent_opportunity_activity`

**Description:**
Retrieves the last 30 days of communication activity between your team and the opportunity. Provides summarized emails and meeting transcripts with key facts extracted and classified by importance (strategic, tactical, high-risk). Noise and small talk are filtered out.

**Parameters:**

| Name                     | Type    | Required | Description                                      |
|--------------------------|---------|----------|--------------------------------------------------|
| `peopleai_opportunity_id`| integer | Yes      | People.ai opportunity ID (obtain via `find_account` or `find_record_by_crm_id`). |

**Returns:**
Formatted summary of recent email and meeting activity with extracted facts, risk indicators, and strategic insights from the last 30 days.

**Use Cases:**
- When the user asks specifically about recent activity or communications on a deal (e.g., "What's been happening on the Acme renewal?").
- Understanding the detailed communication history behind a deal's current state.
- Investigating specific commitments or discussions from the last month.

**Notes:**
- Use only when the user asks specifically about recent activity or communications.
- Do not use for general opportunity questions — use `get_opportunity_status` instead.

---

### `ask_sales_ai_about_opportunity`

**Full name:** `mcp__backstory__ask_sales_ai_about_opportunity`

**Description:**
Consults the SalesAI assistant about a specific opportunity using comprehensive opportunity and account intelligence. SalesAI has access to:

- CRM data
- Last 30 days of communication history
- Opportunity and account scorecards
- Stakeholder information
- Public company filings

**Parameters:**

| Name                     | Type    | Required | Description                                      |
|--------------------------|---------|----------|--------------------------------------------------|
| `question`               | string  | Yes      | The user's sales or opportunity question. Pass it exactly as received. |
| `peopleai_opportunity_id`| integer | Yes      | People.ai opportunity ID (obtain via `find_account` or `find_record_by_crm_id`). |

**Returns:**
SalesAI's expert analysis based on comprehensive opportunity data.

**Use Cases:**
- When the user explicitly asks for detailed or expert analysis beyond the standard overview (e.g., "What's the win strategy for this deal?").
- Complex deal strategy questions requiring cross-referencing CRM data, communications, and external signals.
- Deep-dive analysis on deal risks, competitive dynamics, or stakeholder engagement.

**Notes:**
- Use only if the user explicitly asks for detailed or expert analysis.
- Do not use for general opportunity questions — use `get_opportunity_status` instead.
- Pass the user's question exactly as received.

---

## 4. Deal Analysis

Tools for comparing current deals against historical patterns and outcomes.

---

### `situation_search`

**Full name:** `mcp__backstory__situation_search`

**Description:**
Analyzes a sales opportunity's current situation and finds similar historical cases with resolution outcomes. Given an opportunity and a description of the challenge or concern, this tool:

1. Analyzes recent deal activity to understand the specific situation.
2. Finds past opportunities that faced similar challenges.
3. Evaluates similarity using a structured question checklist.
4. Reports how those situations were resolved — what actions were taken and whether they succeeded.

Returns up to 4 most similar cases (those scoring above 70% similarity) with full resolution analysis.

**Parameters:**

| Name             | Type    | Required | Description                                      |
|------------------|---------|----------|--------------------------------------------------|
| `query`          | string  | Yes      | A concise description of the deal challenge or concern to investigate. Do not fabricate details the user did not mention. |
| `opportunity_id` | integer | Yes      | People.ai opportunity ID (obtain via `find_account` or `find_record_by_crm_id`). |

**Returns:**
- **situation:** Extracted situation description (anonymized with buyer/seller roles).
- **candidates:** Up to 4 most similar historical cases (above 70% match), each containing:
  - `opportunity_id`, `opportunity_name`: Candidate deal identifiers.
  - `account_name`: The account the opportunity belongs to.
  - `opportunity_crm_id`: External CRM identifier.
  - `opportunity_owner_name`: Name of the opportunity owner.
  - `opportunity_amount`: Deal size.
  - `opportunity_close_date`: Close date.
  - `opportunity_is_closed`: Whether the opportunity is closed.
  - `opportunity_is_won`: Whether the opportunity was won.

**Use Cases:**
- Understanding how similar deal situations were handled in the past (e.g., "How did we handle pricing pushback in deals like this?").
- Learning what actions worked (or didn't) in comparable scenarios.
- Getting actionable precedents for overcoming a specific deal challenge.
- Seeking advice or considering options for obstacles in a current deal.

**Notes:**
- If no candidates meet the 70% similarity threshold, reports that no similar situations were found.
- The `query` should be a concise description of the challenge — do not fabricate details the user did not mention.

**Example queries:**
- "Buyer is pushing back on pricing and evaluating competitor alternatives"
- "Champion left the organization mid-deal"
- "Legal review is stalling the procurement process"

---

## Tool Selection Guide

| User Intent                                      | Recommended Tool                     |
|--------------------------------------------------|--------------------------------------|
| "Tell me about [account name]"                   | `find_account` → `get_account_status` |
| "What's happening with [opportunity]?"           | `get_opportunity_status`             |
| "What have we been talking to them about?"       | `get_recent_account_activity` or `get_recent_opportunity_activity` |
| "Any news on [public company]?"                  | `account_company_news`               |
| "Give me a deep analysis of this account"        | `ask_sales_ai_about_account`         |
| "What's the win strategy for this deal?"         | `ask_sales_ai_about_opportunity`     |
| "How did we handle this situation before?"       | `situation_search`                   |
| "Show me my accounts" (no specific name)         | `top_records`                        |
| User provides a Salesforce ID                    | `find_record_by_crm_id`             |

---

## Typical Workflow

```
1. Identify the account/opportunity
   └─ find_account (by name)
   └─ find_record_by_crm_id (by CRM ID)
   └─ top_records (browse relevant records)

2. Get strategic overview
   └─ get_account_status (account-level)
   └─ get_opportunity_status (deal-level)

3. Drill deeper (on explicit request)
   └─ get_recent_account_activity / get_recent_opportunity_activity
   └─ account_company_news
   └─ ask_sales_ai_about_account / ask_sales_ai_about_opportunity
   └─ situation_search (historical pattern matching)
```
