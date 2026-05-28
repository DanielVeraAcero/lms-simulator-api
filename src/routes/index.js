const { Router } = require("express");

const { userRouter } = require("../modules/users/user.routes");
const { courseRouter } = require("../modules/courses/course.routes");
const { enrollmentRouter } = require("../modules/enrollments/enrollment.routes");
const { auditRouter } = require("../modules/audit/audit.routes");
const { dashboardRouter } = require("../modules/dashboard/dashboard.routes");

const router = Router();

router.use("/users", userRouter);
router.use("/courses", courseRouter);
router.use("/enrollments", enrollmentRouter);
router.use("/audit-logs", auditRouter);
router.use("/dashboard", dashboardRouter);

module.exports = { router };
