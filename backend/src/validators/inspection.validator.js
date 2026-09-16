const { z } = require('zod');

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
    image_references: z.array(z.any()).optional().nullable(),
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
      overallVerdict: z.string().optional(),
      violations: z.array(z.any()).optional(),
      warnings: z.array(z.any()).optional(),
      evaluatedAt: z.string().optional()
    }).passthrough()
  })
});

exports.submitInspectionSchema = z.object({
  body: z.object({
    server_version: z.number().int().min(1),
  })
});
