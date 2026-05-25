# Pattern: editing an entity via the DocumentEditProvider

The solution backend on :3008 exposes a structured edit API for entities
in `entities/customers/`. Use this when the user asks you to **change**
an entity (not just read it).

## Endpoints

```
GET  /api/demo-sandbox/entities/:id           # 200 markdown body
PUT  /api/demo-sandbox/entities/:id           # body: { ops: EditOperation[] }
```

`EditOperation` shape (str_replace style):
```json
{ "type": "str_replace", "oldStr": "...", "newStr": "..." }
```

## End-to-end flow

```bash
# 1. Read current state via the API (NOT the file — file lags the API)
curl -s http://localhost:3001/api/demo-sandbox/entities/initech > /tmp/initech.md
cat /tmp/initech.md

# 2. Submit an edit
curl -X PUT http://localhost:3001/api/demo-sandbox/entities/initech \
  -H 'Content-Type: application/json' \
  -d '{
    "ops": [
      {
        "type": "str_replace",
        "oldStr": "status: at-risk",
        "newStr": "status: renewal_at_risk"
      }
    ]
  }'

# 3. Verify
curl -s http://localhost:3001/api/demo-sandbox/entities/initech | grep status
```

## When to use this vs `echo > file`

- **Use the API** when the change is *semantic* (status field, owner,
  tier) — the provider validates edits against `getEditableFields()` and
  the data dictionary
- **Use `echo >>`** for free-form notes / log entries that the user just
  wants appended to the markdown

## Failure modes

- `400 invalid ops` — the `oldStr` didn't appear in the entity
  (check `editable_fields` in the response or just GET first to see
  the current text)
- `403 field-not-editable` — you tried to change a field outside
  `getEditableFields()`. Read `resources/data-dictionary.json` to see
  which fields are editable.
- `404 entity-not-found` — wrong id. `ls entities/customers/` to get
  the actual list.

## Network sanity

The just-bash MCP **does** allow network calls (no firewall). If
`curl` returns "connection refused", the solution backend isn't running
— say so to the user, don't fake an edit.
