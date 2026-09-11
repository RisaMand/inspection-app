const { z } = require('zod');

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
