const { z } = require('zod');

// F2, architecture B: the client uploads photo bytes directly to Supabase
// Storage (via photo.controller.js's signed upload URL) and only ever
// sends back the storage PATH here, never the image bytes or a base64
// blob. A real path always looks like <inspectorUuid>/<photoUuid>.jpg --
// generatePhotoPath() in config/supabaseStorage.js is the only thing that
// ever mints one, so this validates that exact shape rather than z.any()
// silently accepting anything (including the old {url,type} contract, or
// raw base64, neither of which describe reality anymore).
const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PHOTO_PATH_RE = new RegExp(`^${UUID_RE}\\/${UUID_RE}\\.jpg$`, 'i');
const MAX_IMAGES_PER_ITEM = 20; // sanity ceiling against a malformed/malicious payload, well above the frontend's own 7-photo UX nudge (a different, advisory limit)

const imageReferencesSchema = z.array(
  z.string().regex(PHOTO_PATH_RE, { message: 'Each image reference must be a real storage path (<inspectorId>/<photoId>.jpg) returned by POST /photos/upload-url, not raw image data or a URL' })
).max(MAX_IMAGES_PER_ITEM).optional().default([]);
exports.imageReferencesSchema = imageReferencesSchema;

// Same shape as attachComplianceResultSchema's `result` field
// (inspection.validator.js) -- kept in sync deliberately, not re-derived,
// since this is the one real contract Rule Engine's output has to match
// wherever it lands, whether via the standalone attach endpoint or here.
const complianceResultSchema = z.object({
  verdict: z.enum(['COMPLIANT', 'COMPLIANT_WITH_WARNINGS', 'NON_COMPLIANT', 'ERROR']),
  totalRules: z.number().int(),
  passedRules: z.number().int(),
  failedRules: z.number().int(),
  skippedRules: z.number().int(),
  failures: z.array(z.object({
    rule_id: z.string(),
    reason: z.string(),
    severity: z.enum(['cosmetic', 'substantive']),
    clause_citation: z.string(),
    confidence: z.number()
  }))
}).passthrough();

// Discriminated union: CREATE doesn't require baseServerVersion, UPDATE/SUBMIT do
const createItemSchema = z.object({
  clientInspectionId: z.string().uuid(),
  serverId: z.string().uuid().nullable().optional(),
  baseServerVersion: z.number().int().min(1).optional(),
  operation: z.literal('CREATE'),
  clientUpdatedAt: z.string().datetime(),
  ruleConfigVersion: z.string().min(1),
  payload: z.object({
    productName: z.string().optional().nullable(),
    brandName: z.string().optional().nullable(),
    manufacturerName: z.string().optional().nullable(),
    manufacturerAddress: z.string().optional().nullable(),
    packerName: z.string().optional().nullable(),
    packerAddress: z.string().optional().nullable(),
    importerName: z.string().optional().nullable(),
    importerAddress: z.string().optional().nullable(),
    declaredQuantity: z.string().optional().nullable(),
    mrp: z.number().nonnegative().optional().nullable(),
    packedDate: z.string().optional().nullable(),
    expiryDate: z.string().optional().nullable(),
    customerCareDetails: z.string().optional().nullable(),
    barcodeValue: z.string().optional().nullable(),
    imageReferences: imageReferencesSchema,
    ocrPayload: z.any().optional().nullable(),
    extractedFields: z.any().optional().default({}),
    status: z.enum(['DRAFT', 'PENDING_REVIEW', 'COMPLETED', 'CONFLICTED']).optional(),
    mrpRawText: z.string().optional().nullable(),
    // Closeout Step 4: which visit (session) this capture belongs to.
    // Optional/nullable because older or offline-first clients may not
    // send one yet -- an inspection without a session is still valid,
    // just not traceable back to a visit server-side.
    sessionId: z.string().uuid().optional().nullable(),
    // F1: the client's on-device Rule Engine already computed a verdict
    // before this item was ever queued for sync (pipeline step 7, before
    // step 9's save) -- this accepts that object as-is rather than
    // triggering any server-side evaluation, since none exists.
    complianceStatus: z.enum(['EVALUATED', 'FAILED']).optional(),
    complianceResult: complianceResultSchema.optional(),
  })
});

const updateItemSchema = z.object({
  clientInspectionId: z.string().uuid(),
  serverId: z.string().uuid().nullable().optional(),
  baseServerVersion: z.number().int().min(1),
  operation: z.enum(['UPDATE', 'SUBMIT']),
  clientUpdatedAt: z.string().datetime(),
  ruleConfigVersion: z.string().min(1),
  payload: z.object({
    productName: z.string().optional().nullable(),
    brandName: z.string().optional().nullable(),
    manufacturerName: z.string().optional().nullable(),
    manufacturerAddress: z.string().optional().nullable(),
    packerName: z.string().optional().nullable(),
    packerAddress: z.string().optional().nullable(),
    importerName: z.string().optional().nullable(),
    importerAddress: z.string().optional().nullable(),
    declaredQuantity: z.string().optional().nullable(),
    mrp: z.number().nonnegative().optional().nullable(),
    packedDate: z.string().optional().nullable(),
    expiryDate: z.string().optional().nullable(),
    customerCareDetails: z.string().optional().nullable(),
    barcodeValue: z.string().optional().nullable(),
    imageReferences: imageReferencesSchema,
    ocrPayload: z.any().optional().nullable(),
    extractedFields: z.any().optional().default({}),
    status: z.enum(['DRAFT', 'PENDING_REVIEW', 'COMPLETED', 'CONFLICTED']).optional(),
    mrpRawText: z.string().optional().nullable(),
    sessionId: z.string().uuid().optional().nullable(),
    complianceStatus: z.enum(['EVALUATED', 'FAILED']).optional(),
    complianceResult: complianceResultSchema.optional(),
  })
});

exports.syncSchema = z.object({
  body: z.object({
    deviceId: z.string().optional(),
    idempotencyKey: z.string().min(1),
    items: z.array(z.discriminatedUnion('operation', [
      createItemSchema,
      updateItemSchema
    ]))
  })
});