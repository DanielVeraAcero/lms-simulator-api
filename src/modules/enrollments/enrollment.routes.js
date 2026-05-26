const { Router } = require("express");
const { z } = require("zod");

const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/async-handler");
const {
  cancelEnrollment,
  createEnrollment,
  getEnrollmentById,
  listEnrollments,
  updateEnrollment,
} = require("./enrollment.service");
const {
  createEnrollmentSchema,
  enrollmentQuerySchema,
  updateEnrollmentSchema,
} = require("./enrollment.schemas");

const router = Router();
const enrollmentIdParamSchema = z.object({ enrollmentId: z.string().uuid() });

router.post(
  "/",
  validate(createEnrollmentSchema),
  asyncHandler(async (request, response) => {
    const enrollment = await createEnrollment(request.body);
    response.status(201).json({ data: enrollment });
  }),
);

router.get(
  "/",
  validate(enrollmentQuerySchema, "query"),
  asyncHandler(async (request, response) => {
    const enrollments = await listEnrollments(request.query);
    response.json({ data: enrollments });
  }),
);

router.get(
  "/:enrollmentId",
  validate(enrollmentIdParamSchema, "params"),
  asyncHandler(async (request, response) => {
    const enrollment = await getEnrollmentById(request.params.enrollmentId);
    response.json({ data: enrollment });
  }),
);

router.patch(
  "/:enrollmentId",
  validate(enrollmentIdParamSchema, "params"),
  validate(updateEnrollmentSchema),
  asyncHandler(async (request, response) => {
    const enrollment = await updateEnrollment(request.params.enrollmentId, request.body);
    response.json({ data: enrollment });
  }),
);

router.delete(
  "/:enrollmentId",
  validate(enrollmentIdParamSchema, "params"),
  asyncHandler(async (request, response) => {
    const enrollment = await cancelEnrollment(request.params.enrollmentId);
    response.json({ data: enrollment });
  }),
);

module.exports = { enrollmentRouter: router };
