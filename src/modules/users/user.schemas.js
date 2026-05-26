const { z } = require("zod");

const { metadataSchema } = require("../shared/schemas");

const userStatuses = ["active", "inactive", "archived"];
const contactTypes = ["student", "marketing", "staff"];

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  externalContactId: z.string().max(100).optional().nullable(),
  contactType: z.enum(contactTypes).default("student"),
  status: z.enum(userStatuses).default("active"),
  metadata: metadataSchema,
});

const updateUserSchema = createUserSchema.partial();

const userQuerySchema = z.object({
  email: z.string().email().optional(),
  status: z.enum(userStatuses).optional(),
  contactType: z.enum(contactTypes).optional(),
});

module.exports = {
  contactTypes,
  createUserSchema,
  updateUserSchema,
  userQuerySchema,
  userStatuses,
};
