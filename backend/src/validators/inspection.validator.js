const { z } = require('zod');

// F2: same real storage-path shape as sync.validator.js's
// imageReferencesSchema, duplicated here deliberately (matches this file's
// own existing pattern for complianceResultSchema below) since there's no
// shared import path back to sync.validator.js today.
const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PHOTO_PATH_RE = new RegExp(`^${UUID_RE}\\/${UUID_RE}\\.jpg$`, 'i');
const MAX_IMAGES_PER_ITEM = 20;
const imageReferencesSchema = z.array(
  z.string().regex(PHOTO_PATH_RE, { message: 'Each image reference must be a real storage path (<inspectorId>/<photoId>.jpg) returned by POST /photos/upload-url, not raw image data or a URL' })
).max(MAX_IMAGES_PER_ITEM).optional().nullable();

exports.updateInspectionSchema = z.object({
  body: z.object({
    server_version: z.number().int().min(1),
    product_name: z.string().optional().nullable(),
    brand_name: z.string().optional().nullable(),
    manufacturer_name: z.string().optional().nullable(),
    manufacturer_address: z.string().optional().nullable(),
    packer_name: z.string().optional().nullable(),
    packer_address: z.string().optional().nullable(),
    importer_name: z.string().optional().nullable(),
    importer_address: z.string().optional().nullable(),
    declared_quantity: z.string().optional().nullable(),
    mrp: z.number().nonnegative().optional().nullable(),
    packed_date: z.string().optional().nullable(),
    expiry_date: z.string().optional().nullable(),
    customer_care_details: z.string().optional().nullable(),
    barcode_value: z.string().optional().nullable(),
    mrp_raw_text: z.string().optional().nullable(),
    image_references: imageReferencesSchema,
    ocr_payload: z.any().optional().nullable(),
    extracted_fields: z.any().optional().nullable(),
    status: z.enum(['DRAFT', 'PENDING_REVIEW', 'COMPLETED', 'CONFLICTED']).optional(),
  })
});

exports.attachComplianceResultSchema = z.object({
  body: z.object({
    ruleConfigVersion: z.string().min(1),
    status: z.enum(['EVALUATED', 'FAILED']),
    result: z.object({
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
    }).passthrough()
  })
});

exports.submitInspectionSchema = z.object({
  body: z.object({
    server_version: z.number().int().min(1),
  })
});
