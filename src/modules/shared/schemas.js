const { z } = require("zod");

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

const metadataSchema = z.record(z.any()).optional().default({});

module.exports = { uuidParamSchema, metadataSchema };
