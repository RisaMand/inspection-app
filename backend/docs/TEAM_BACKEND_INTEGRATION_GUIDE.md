# SIH26034 Team Backend Integration Guide

This is the single source of truth for integrating with the existing, verified Node.js + Express backend. All contracts, endpoints, and behaviors described here have been implemented, tested, and exist in the live repository.

---

## 1. Project and Ownership

**The Backend Team Owns:**
- The Express REST API layer
- PostgreSQL storage, schema design, and migrations
- JWT authentication and role-based authorization
- Request validation and security enforcement (CORS, payload limits)
- Rule-config JSON storage and version serving
- Offline sync, idempotency, and optimistic conflict handling
- Dashboard analytics and report-data retrieval APIs

**The Backend Team Does NOT Own:**
- Frontend UI, mobile apps, or PWA offline caching logic
- CV/OCR image processing, confidence scoring, or ML models
- Legal-rule logic tree evaluation or AST parsing
- HTML/PDF Document generation
- DevOps, Dockerization, or deployment infrastructure

---

## 2. High-Level System Flow

The backend expects the following strict data flow:

```text
PWA Image Capture (Team: Frontend/PWA, No backend endpoint)
  ↓
CV/OCR extracts structured data (Team: CV/OCR, PWA triggers service directly)
  ↓
Backend saves/syncs inspection (Team: Backend, Endpoint: POST /api/v1/sync/inspections)
  ↓
Rule Engine evaluates config (Team: Rule Engine, Endpoint: GET /api/v1/rules/versions/:version)
  ↓
Rule Engine submits verdict (Team: Backend, Endpoint: POST /api/v1/inspections/:id/compliance-result)
  ↓
Dashboard & Doc Gen read data (Team: Backend, Endpoints: GET /api/v1/dashboard/* & GET /api/v1/inspections/:id/report-data)
```

---

## 3. Local Setup and Security

The backend requires the following secure local environment.

**Core Commands:**
- **Run Backend:** `npm run dev`
- **Run Migrations:** `npm run migrate`
- **Seed Database:** `npm run seed`
- **Run Test Suite:** `npm run test`

**Security & Environment Rules:**
- A `.env` file must be created based on `.env.example`. **It must never be committed to version control.**
- Required environment variables: `NODE_ENV`, `PORT`, `DATABASE_URL`, `DATABASE_SSL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `BCRYPT_SALT_ROUNDS`, `MAX_JSON_BODY_SIZE`, `LOG_LEVEL`.
- **Database SSL:** If connecting to a hosted PostgreSQL provider (like Supabase), `DATABASE_SSL=true` is strictly required.
- **Database Isolation:** Frontend, Rule Engine, and OCR services must **never** connect directly to the PostgreSQL database. All communication must happen via the documented API.
- **Migrations:** All database schema changes require coordination and an additive `00X_name.sql` migration script.

---

## 4. Auth and API Conventions

- **Login Flow:** Clients authenticate via `POST /api/v1/auth/login` using `email` and `password`. The API returns a JWT.
- **Token Format:** The JWT must be supplied in the HTTP header: `Authorization: Bearer <token>`.
- **Roles:** The system enforces three roles: `INSPECTOR`, `OFFICIAL`, and `ADMIN`.
- **Ownership:** Inspectors are strictly isolated. They can only retrieve and modify records they created. Accessing another inspector's record returns a `403 Forbidden`.
- **Pagination:** Collection endpoints accept `page` and `limit` query strings.

### Success Payload Shape
```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 50, "page": 1, "limit": 10, "totalPages": 5 }
}
```

### Error Payload Shape
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [ { "path": "body.mrp", "message": "Expected number" } ]
  },
  "requestId": "uuid"
}
```

### Expected HTTP Error Codes
- `400 Bad Request`: Validation failure (Zod) or invalid state transition.
- `401 Unauthorized`: Missing, expired, or invalid JWT.
- `403 Forbidden`: Authenticated, but lacks required role or ownership of the record.
- `404 Not Found`: Record does not exist.
- `409 Conflict`: Stale update detected (Optimistic Locking failure).

---

## 5. Frontend/PWA Contract

**Login / Session:**
- `POST /api/v1/auth/login` (Auth)
- `GET /api/v1/auth/me` (Retrieve current user context)

**Inspection CRUD:**
- `GET /api/v1/inspections` (List, filters: `status`, `ruleConfigVersion`, `page`, `limit`)
- `GET /api/v1/inspections/:id` (Read)
- `PATCH /api/v1/inspections/:id` (Update. Strictly requires `server_version` in the body)
- `POST /api/v1/inspections/:id/submit` (Submit. Strictly requires `server_version` in the body. Transitions status to `PENDING_REVIEW`.)

**Active Rule-Config Retrieval:**
- `GET /api/v1/rules/active`: The PWA must fetch and cache this. When creating an inspection, the exact `version` string from this endpoint must be stamped on the inspection payload.

### Offline Sync (`POST /api/v1/sync/inspections`)
- **Idempotency:** The request body must include an `idempotencyKey` UUID. If the network drops and the PWA retries the exact same payload with the same key, the backend returns the cached `200 OK` success response without duplicating database rows.
- **Batch Processing:** Accepts an `items` array. Failure of one item does not roll back the entire batch (Partial Success).
- **Client ID:** The PWA must generate and provide a UUID `clientInspectionId`.
- **Conflicts & Server Versions:** 
  - `CREATE` operations **do not require** `baseServerVersion`. The field is optional for create operations.
  - `UPDATE` and `SUBMIT` operations **require** `baseServerVersion` (positive integer). 
  - If `baseServerVersion` sent by the client is lower than the database's `server_version`, a stale update is detected.
- **Stale-Update Conflict Response:** The backend refuses to overwrite the data. It returns `status: "CONFLICT"` for that item in the results array, along with the actual `serverVersion` and `serverId`.
- **Frontend Action Required:** On `CONFLICT`, the PWA must prompt the user or automatically merge the changes, then re-sync with the new `baseServerVersion`.

---

## 6. CV/OCR Contract

The Backend acts exclusively as a secure JSON storage layer for OCR data.
- **Recommended Integration Flow:** `PWA capture → PWA requests CV/OCR service → CV/OCR returns structured JSON → PWA embeds JSON in backend inspection payload`.
- **Storage Fields:** The backend accepts unrestricted JSON in the following keys during sync or updates:
  - `image_references` (Array)
  - `ocr_payload` (Object)
  - `extracted_fields` (Object)
- **Constraint:** The OCR team does not write directly to the database. The backend does not execute Python OCR scripts.

*(Pending Team Decision: Is the OCR service a standalone cloud API called by the PWA, or an on-device library? The backend accommodates either, so long as the PWA delivers the final JSON).*

---

## 7. Rule Engine Contract

The Rule Engine operates as an external microservice or script. The backend stores configurations and verdicts but never evaluates logic.

- **Rule Configuration Sync:** The Rule Engine requests the exact configuration used for a specific inspection via `GET /api/v1/rules/versions/:version`.
- **Submitting Verdicts:** `POST /api/v1/inspections/:id/compliance-result`.
- **Authorization:** `ADMIN` (or a dedicated internal service account mapped to ADMIN).
- **Match Requirement:** The `ruleConfigVersion` in the submission payload must exactly match the `rule_config_version` stored on the inspection. A mismatch yields a `400 Bad Request`.

*(Pending Team Decision: What triggers the Rule Engine? There is no trigger implemented in the backend. The Rule Engine must either poll the database for `PENDING_REVIEW` inspections, or the PWA must trigger it via webhook).*

---

## 8. Document Generation Contract

The backend aggregates all necessary data into a single, flat, read-only endpoint so the Document Generation team does not need to execute complex SQL joins.

- **Endpoint:** `GET /api/v1/inspections/:id/report-data`
- **Authorization:** `INSPECTOR`, `OFFICIAL`, `ADMIN`
- **Fields Provided:** Inspection metadata, inspector identity (name/email), captured fields, CV/OCR extracted fields, image references, rule configuration version, and the final evaluated compliance result.

---

## 9. Dashboard Contract

These endpoints are restricted to managerial roles for analytics.
- `GET /api/v1/dashboard/summary` (Auth: `OFFICIAL`, `ADMIN`)
- `GET /api/v1/dashboard/violations` (Auth: `OFFICIAL`, `ADMIN`)
- `GET /api/v1/dashboard/inspectors` (Auth: `OFFICIAL`, `ADMIN`)
- `GET /api/v1/dashboard/inspections` (Auth: `OFFICIAL`, `ADMIN`)

---

## 10. API Quick-Reference

| Method | Endpoint | Consumer Team | Required Role | Purpose / Notes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | QA / DevOps | None | Liveness probe. |
| `POST` | `/api/v1/auth/login` | PWA | None | Returns JWT for auth. |
| `GET` | `/api/v1/auth/me` | PWA | Authenticated | Validate token, get user data. |
| `GET` | `/api/v1/rules/active` | PWA | Authenticated | Fetches current config string to stamp on inspections. |
| `GET` | `/api/v1/rules/versions/:version` | Rule Engine | Authenticated | Retrieve historical rule configurations. |
| `POST` | `/api/v1/sync/inspections` | PWA | INSPECTOR, ADMIN | Offline-first idempotent sync (Create/Update). |
| `GET` | `/api/v1/inspections` | PWA, Dashboard| INSP, OFF, ADMIN | List inspections. Isolated to the requesting inspector. |
| `PATCH`| `/api/v1/inspections/:id` | PWA | INSPECTOR, ADMIN | Update fields. Strictly requires `server_version`. |
| `POST` | `/api/v1/inspections/:id/submit`| PWA | INSPECTOR, ADMIN | Submit for review. Strictly requires `server_version`. |
| `POST` | `/api/v1/inspections/:id/compliance-result` | Rule Engine | ADMIN | Attach engine verdict. Validates version match. |
| `GET` | `/api/v1/inspections/:id/report-data` | Doc Gen | INSP, OFF, ADMIN | Aggregated, flat JSON payload for PDF templating. |
| `POST`| `/api/v1/sessions` | PWA | INSPECTOR | Initialize scanning session with visit_number, shop_number, GPS. |
| `GET` | `/api/v1/sessions/:id` | PWA | INSPECTOR | Get session details. Inspector ownership enforced. |
| `PATCH`| `/api/v1/sessions/:id/close` | PWA | INSPECTOR | Close session. Sets end_time. Inspector ownership enforced. |
| `GET` | `/api/v1/dashboard/summary` | Dashboard | OFFICIAL, ADMIN | Summary analytics for Officials. |

---

## 11. Team Pre-Demo Checklists

**Frontend / PWA:**
- [ ] Ensure JWT is attached to `Authorization` header on every request.
- [ ] Gracefully handle `401 Unauthorized` by redirecting to login.
- [ ] Explicitly handle `409 Conflict` and prompt the user to resolve data merges.
- [ ] Persist and resend `idempotencyKey` on network retry during sync.

**CV / OCR:**
- [ ] Provide a predictable, stable JSON schema for `extractedFields` and `ocrPayload`.
- [ ] Confirm integration points with the PWA team (Device vs. Cloud).

**Rule Engine:**
- [ ] Ensure evaluation logic handles empty or null `extractedFields` safely.
- [ ] Ensure payload correctly includes the exact `ruleConfigVersion` string.

**Document Generation:**
- [ ] Ensure templates handle `PENDING_REVIEW` states where `complianceResult` may still be `null`.

**QA / Integration:**
- [ ] Test offline sync queue processing by disconnecting the network, creating an inspection, and reconnecting.

---

## 12. Known Limitations
- **Rate Limiting:** `/auth/login` lacks IP-based brute-force rate limiting. This is acceptable for a hackathon environment but required for production.
- **CI Database Lifecycle:** Automated integration tests currently run against static environment mocks to verify module integrity. For robust CI, a local PostgreSQL Docker container should be spun up dynamically during the GitHub Actions test phase.
- **Architectural Triggers:** As noted above, the explicit triggers for the OCR and Rule Engine microservices must be finalized between the teams, as the Backend currently acts as a passive, secure storage layer responding to HTTP requests.
