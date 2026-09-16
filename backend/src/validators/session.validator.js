const { z } = require('zod');

const createSessionSchema = z.object({
  body: z.object({
    visit_number: z.string()
      .max(50, 'Visit number must not exceed 50 characters')
      .optional(),
    shop_number: z.string()
      .max(50, 'Shop number must not exceed 50 characters')
      .optional(),
    gps_lat: z.number()
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90')
      .optional(),
    gps_lng: z.number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180')
      .optional()
  }).strict().default({})
});

// A5: session/product routes had zero param validation -- a malformed ID
// (e.g. "not-a-real-uuid") reached Postgres raw and threw a 500 (22P02)
// instead of a clean 400. This schema catches that at the edge.
const sessionIdParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('id must be a valid UUID')
  })
});

module.exports = {
  createSessionSchema,
  sessionIdParamsSchema
};