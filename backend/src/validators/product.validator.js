const { z } = require('zod');

// A5: /:id/history had zero param validation -- a malformed ID reached
// Postgres raw and threw a 500 (22P02) instead of a clean 400.
const productIdParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('id must be a valid UUID')
  })
});

module.exports = {
  productIdParamsSchema
};