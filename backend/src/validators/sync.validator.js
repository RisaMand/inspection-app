const { z } = require('zod');

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
    imageReferences: z.array(z.any()).optional().default([]),
    ocrPayload: z.any().optional().nullable(),
    extractedFields: z.any().optional().default({}),
    status: z.enum(['DRAFT', 'PENDING_REVIEW', 'COMPLETED', 'CONFLICTED']).optional(),
    mrpRawText: z.string().optional().nullable(),
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
    imageReferences: z.array(z.any()).optional().default([]),
    ocrPayload: z.any().optional().nullable(),
    extractedFields: z.any().optional().default({}),
    status: z.enum(['DRAFT', 'PENDING_REVIEW', 'COMPLETED', 'CONFLICTED']).optional(),
    mrpRawText: z.string().optional().nullable(),
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
