const { Router } = require("express");
const { z } = require("zod");

const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/async-handler");
const {
  archiveCourse,
  createCourse,
  getCourseById,
  listCourses,
  updateCourse,
} = require("./course.service");
const {
  courseQuerySchema,
  createCourseSchema,
  updateCourseSchema,
} = require("./course.schemas");

const router = Router();
const courseIdParamSchema = z.object({ courseId: z.string().uuid() });

router.post(
  "/",
  validate(createCourseSchema),
  asyncHandler(async (request, response) => {
    const course = await createCourse(request.body);
    response.status(201).json({ data: course });
  }),
);

router.get(
  "/",
  validate(courseQuerySchema, "query"),
  asyncHandler(async (request, response) => {
    const courses = await listCourses(request.query);
    response.json({ data: courses });
  }),
);

router.get(
  "/:courseId",
  validate(courseIdParamSchema, "params"),
  asyncHandler(async (request, response) => {
    const course = await getCourseById(request.params.courseId);
    response.json({ data: course });
  }),
);

router.patch(
  "/:courseId",
  validate(courseIdParamSchema, "params"),
  validate(updateCourseSchema),
  asyncHandler(async (request, response) => {
    const course = await updateCourse(request.params.courseId, request.body);
    response.json({ data: course });
  }),
);

router.delete(
  "/:courseId",
  validate(courseIdParamSchema, "params"),
  asyncHandler(async (request, response) => {
    const course = await archiveCourse(request.params.courseId);
    response.json({ data: course });
  }),
);

module.exports = { courseRouter: router };
