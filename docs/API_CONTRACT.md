# Visual AI Agent — API Contract Specification

Base URL: `/api/v1`
Authentication: Header `X-Install-Key: <UUID>` (generated per extension installation)

---

## Endpoints Summary

### 1. Ingestion
- `POST /api/v1/events/batch`
  - Ingests buffered event array.
- `POST /api/v1/screenshots`
  - Multipart upload containing image data + session/event metadata.

### 2. Activity Feed & Timeline
- `GET /api/v1/activity/timeline?domain=&from=&to=&page=`
  - Returns paginated timeline feed of events and screenshot summaries.

### 3. Privacy & Governance Rules
- `GET /api/v1/privacy/rules` — List active privacy rules.
- `POST /api/v1/privacy/rules` — Create domain block/allow rule.
- `DELETE /api/v1/privacy/rules/{id}` — Delete rule by ID.

### 4. User Data Rights
- `POST /api/v1/data/export` — Trigger export of user's accumulated data.
- `POST /api/v1/data/delete` — Purge user data permanently.

### 5. Health Check
- `GET /api/v1/health` — Service readiness & status check (No Auth required).
  - Response: `{"status": "ok", "service": "visual-ai-agent-backend", "environment": "development"}`
