# Compliance Scanner - Integration Readiness

This document defines the strict API contracts and boundaries between the Backend and all other hackathon teams (Frontend/PWA, CV/OCR, Rule Engine, and Document Generation).

## Standard API Shapes
All endpoints are prefixed with `/api/v1`.

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 10 } // Optional pagination
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR", // e.g., CONFLICT, NOT_FOUND, FORBIDDEN
    "message": "Human readable reason",
    "details": []
  },
  "requestId": "uuid"
}
```

---

## 1. Frontend / PWA Team

**Owner Team:** Frontend  
**Integration Status:** ✅ Ready

### Authentication (`POST /auth/login`)
- **Authorized Role:** None (Public)
- **Request Example:** `{"email": "inspector@compliance.local", "password": "password123"}`
- **Response Example:** `{"success": true, "data": {"token": "jwt.string...", "user": {"role": "INSPECTOR"}}}`
- **Behavior:** The returned JWT must be included in the `Authorization: Bearer <token>` header for all subsequent requests.

### Active Rule Configuration (`GET /rules/active`)
- **Authorized Role:** Any Authenticated User
- **Response Example:** `{"success": true, "data": {"version": "LMR-2011-v1", "rules": [...]}}`
- **Behavior:** The Frontend must fetch and cache this. When creating an inspection offline, the UI must stamp it with this exact `version` string.

### Offline Sync (`POST /sync/inspections`)
- **Authorized Role:** INSPECTOR, ADMIN
- **Request Example:**
```json
{
  "idempotencyKey": "uuid-for-retry",
  "items": [{
    "clientInspectionId": "uuid-generated-on-device",
    "baseServerVersion": 1,
    "operation": "CREATE", 
    "clientUpdatedAt": "2023-10-25T10:00:00Z",
    "ruleConfigVersion": "LMR-2011-v1",
    "payload": {
      "productName": "Water Bottle",
      "status": "DRAFT"
    }
  }]
}
```
- **Response Example:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "clientInspectionId": "uuid",
        "status": "SYNCED",
        "serverId": "uuid-server-id",
        "serverVersion": 1
      }
    ]
  }
}
```
- **Error/Conflict Behavior:** 
  - If a network error occurs, the client can safely retry using the exact same `idempotencyKey` and payload; the server will return the cached `200 OK` success response. 
  - If an `UPDATE` is sent with a `baseServerVersion` lower than the actual database `server_version`, the server will NOT overwrite the data. It will return a `status: "CONFLICT"` for that item, requiring the frontend to handle the merge.
  - Partial success applies: One malformed item in the array does not fail the entire batch.

### Inspection CRUD (`PATCH /inspections/:id` and `POST /inspections/:id/submit`)
- **Authorized Role:** INSPECTOR (Must own the record)
- **Behavior:** Updates require `{ "server_version": <number> }` in the body for optimistic locking. Submitting transitions the status from `DRAFT` to `PENDING_REVIEW` and locks the record from further inspector updates.

---

## 2. CV / OCR Team

**Owner Team:** CV / OCR  
**Integration Status:** ✅ Ready

- **Backend Responsibility:** The Backend acts exclusively as a storage and retrieval layer for OCR outputs. The backend **does not** run OCR inference, validate confidence scores, or parse raw images.
- **Contract:** The Frontend/PWA will capture images and process them through the CV/OCR team's pipeline (or the PWA will pass the OCR team's JSON output directly to the backend). 
- **Storage Fields:** The `sync` and `PATCH` endpoints accept the following unrestricted JSON fields in the inspection payload:
  - `imageReferences`: `[ { "url": "...", "type": "front_panel" } ]`
  - `ocrPayload`: `{ "rawText": "...", "confidence": 0.9 }`
  - `extractedFields`: `{ "mrp": 50.00, "declaredQuantity": "500ml" }`

---

## 3. Rule Engine Team

**Owner Team:** Rule Engine  
**Integration Status:** ✅ Ready

- **Backend Responsibility:** The Backend serves the rule configuration JSON safely, but **does not** calculate the compliance verdict, parse ASTs, or run logic trees.
- **Rule Config Lookup (`GET /rules/versions/:version`):** The Rule Engine can fetch the exact, immutable rule set used for a specific inspection.

### Attach Compliance Result (`POST /inspections/:id/compliance-result`)
- **Authorized Role:** ADMIN (or Internal Service Role mapped to Admin for the hackathon)
- **Request Example:**
```json
{
  "ruleConfigVersion": "LMR-2011-v1",
  "status": "EVALUATED",
  "result": {
    "overallVerdict": "NON_COMPLIANT",
    "violations": ["MRP format incorrect"],
    "evaluatedAt": "2023-10-25T10:05:00Z"
  }
}
```
- **Error/Conflict Behavior:** If the `ruleConfigVersion` in the payload does not match the version stamped on the inspection by the inspector, the backend will return a `400 Bad Request`.

---

## 4. Document Generation Team

**Owner Team:** Document Generation (Doc Gen)  
**Integration Status:** ✅ Ready

- **Backend Responsibility:** The backend **does not** generate PDFs, Seizure Memos, or HTML reports. It provides a flat, stable, aggregated JSON payload for the Doc Gen team's templates.

### Report Data (`GET /inspections/:id/report-data`)
- **Authorized Role:** INSPECTOR, OFFICIAL, ADMIN
- **Response Example:**
```json
{
  "success": true,
  "data": {
    "inspectionId": "uuid",
    "clientInspectionId": "uuid",
    "status": "COMPLETED",
    "inspector": {
      "id": "uuid",
      "name": "Inspector One",
      "email": "inspector@compliance.local"
    },
    "capturedData": {
      "productName": "Test Product",
      "brandName": "Test Brand",
      "manufacturerName": "ABC Manufacturing",
      "manufacturerAddress": "123 Industrial Area",
      "packerName": "XYZ Packers",
      "packerAddress": "456 Packing District",
      "importerName": "Import Co",
      "importerAddress": "789 Trade Zone",
      "declaredQuantity": "500ml",
      "mrp": "50.00",
      "mrpRawText": "MRP Rs. 50.00",
      "packedDate": "2025-01-01",
      "expiryDate": "2026-12-31",
      "customerCareDetails": "Call 1800-XXX-XXXX",
      "barcodeValue": "BAR123456"
    },
    "extractedFields": { ... },
    "imageReferences": [ ... ],
    "ruleConfigVersion": "LMR-2011-v1",
    "ruleEngineStatus": "EVALUATED",
    "complianceResult": {
      "overallVerdict": "NON_COMPLIANT"
    },
    "timestamps": {
      "createdAt": "2023-10-25...",
      "updatedAt": "2023-10-25..."
    }
  }
}
```

---

## Pending Team Decisions / Action Items
1. **Frontend / OCR Flow:** The teams must confirm whether the PWA calls the OCR service directly and then sends the structured JSON to the Backend, or if the Backend is expected to proxy the image to the OCR service (currently, the Backend strictly expects the PWA to send the *completed* JSON payload).
2. **Rule Engine Trigger:** Teams must confirm what triggers the Rule Engine. Does the Rule Engine poll the database? Does the Frontend call the Rule Engine directly after submitting? Or is the Rule Engine a background cron job? (Currently, the Rule Engine acts as an external service that pushes results to the Backend).
