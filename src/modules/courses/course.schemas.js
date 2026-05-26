const { z } = require("zod");

const { metadataSchema } = require("../shared/schemas");

const courseStatuses = ["draft", "published", "archived"];

const createCourseSchema = z.object({
  courseCode: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(courseStatuses).default("draft"),
  metadata: metadataSchema,
});

const updateCourseSchema = createCourseSchema.partial();

const courseQuerySchema = z.object({
  courseCode: z.string().min(1).max(100).optional(),
  status: z.enum(courseStatuses).optional(),
});

module.exports = {
  courseQuerySchema,
  courseStatuses,
  createCourseSchema,
  updateCourseSchema,
};
