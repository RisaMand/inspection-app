const { z } = require('zod');

exports.createRuleConfigSchema = z.object({
  body: z.object({
    version: z.string().min(1, 'Version is required'),
    rules: z.any() // JSON blob, any valid JSON
  })
});

// A3: activation is keyed by version (not a UUID id, which createRuleConfig
// never returned) -- matches getRuleByVersion's existing pattern.
exports.activateRuleConfigSchema = z.object({
  params: z.object({
    version: z.string().min(1, 'Version is required')
  })
});