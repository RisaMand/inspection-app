# Integration Contracts

## Frontend / PWA Handoff

### Offline Sync
The core integration for the offline PWA is `POST /api/v1/sync/inspections`.
- **Idempotency:** Include a unique `idempotencyKey` per request. Repeated requests with the exact same payload and key will return the previous success response.
- **Payload Hash:** Repeated keys with different payloads will return a `409 Conflict`.
- **Conflicts:** The backend implements a "Server-Wins" conflict policy. If `baseServerVersion` sent by the client does not match `server_version` in the DB, the server will not overwrite data. It will return a `CONFLICT` status for that item and provide the `serverRecord` and `serverVersion` so the client can resolve it.
- **Rule Configuration:** Every new inspection *must* supply the `ruleConfigVersion` it was created against. Ensure you fetch and cache `GET /api/v1/rules/active`.
- **Version Requirements:**
  - `CREATE` operations: `baseServerVersion` is **optional** (can be omitted).
  - `UPDATE` and `SUBMIT` operations: `baseServerVersion` is **required** (must be a positive integer matching the current server version).

## Rule Engine Handoff
- Backend stores rule configs but does *not* evaluate logic.
- Rule Engine fetches config via `GET /api/v1/rules/versions/:version`.
- Upon evaluation, Rule Engine posts the result to `POST /api/v1/inspections/:id/compliance-result`.
- `ruleConfigVersion` must strictly match the inspection's version to ensure legal validity.

## CV / OCR Handoff
- The backend API accepts raw structured JSON output from CV/OCR processes in the `ocrPayload` and `imageReferences` fields of an inspection payload.
- The backend does not process images, validate OCR confidence, or interact with ML models directly.

## Document Generation Handoff
- Doc Gen uses `GET /api/v1/inspections/:id/report-data` to retrieve a comprehensive, flat JSON structure containing all necessary data (inspector identity, extracted fields, compliance verdict, timestamps).
- The backend does not generate PDFs, reports, or HTML files.
