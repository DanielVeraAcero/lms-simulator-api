const { z } = require("zod");

const { metadataSchema } = require("../shared/schemas");

const enrollmentStatuses = ["active", "completed", "cancelled"];

const createEnrollmentSchema = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid().optional(),
  courseCode: z.string().min(1).max(100).optional(),
  status: z.enum(enrollmentStatuses).default("active"),
  metadata: metadataSchema,
}).refine((value) => value.courseId || value.courseCode, {
  message: "Either courseId or courseCode is required",
  path: ["courseId"],
});

const updateEnrollmentSchema = z.object({
  status: z.enum(enrollmentStatuses).optional(),
  completedAt: z.string().datetime().optional().nullable(),
  metadata: metadataSchema.optional(),
});

const enrollmentQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  courseCode: z.string().min(1).max(100).optional(),
  status: z.enum(enrollmentStatuses).optional(),
});

module.exports = {
  createEnrollmentSchema,
  enrollmentQuerySchema,
  enrollmentStatuses,
  updateEnrollmentSchema,
};
