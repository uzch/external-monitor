# Fixtures

Foundation v0 fixtures are synthetic and local. Do not add real customer, employee, territory, transcript, spreadsheet, or internal Red Hat data.

## Expected files

```text
hierarchy-nodes.json
accounts.json
account-assignments.json
external-events.json
relevance-evaluations.json
red-hat-capabilities.json
```

## Minimum scenarios
- multiple hierarchy levels and at least two sibling scopes;
- 10+ accounts across mapped and incomplete mappings;
- prioritized, monitor, context, excluded, and duplicate events;
- one account with multiple prioritized signals;
- one account with no qualifying signal;
- one duplicate group;
- one strong-evidence/weak-relevance event;
- one plausible-relevance/weak-evidence event;
- one stale event;
- one general-relevance-only event;
- one account with multiple assignments.

Use stable synthetic IDs and example URLs. Foundation v0 must not fetch those URLs.
