const { query } = require("../../config/database");
const { AppError } = require("../../errors/app-error");
const { createAuditLog } = require("../audit/audit.service");

function mapEnrollmentRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    status: row.status,
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureUserAndCourseAreValid(userId, courseId) {
  const userResult = await query(`select id, status from lms_users where id = $1`, [userId]);
  const courseResult = await query(`select id, status from lms_courses where id = $1`, [courseId]);

  if (!userResult.rows[0]) {
    throw new AppError(404, "User not found");
  }

  if (!courseResult.rows[0]) {
    throw new AppError(404, "Course not found");
  }

  if (userResult.rows[0].status === "archived") {
    throw new AppError(409, "Archived users cannot be enrolled");
  }

  if (courseResult.rows[0].status === "archived") {
    throw new AppError(409, "Archived courses cannot receive enrollments");
  }
}

async function createEnrollment(payload) {
  await ensureUserAndCourseAreValid(payload.userId, payload.courseId);

  const existing = await query(
    `
      select * from lms_enrollments
      where user_id = $1 and course_id = $2
    `,
    [payload.userId, payload.courseId],
  );

  if (existing.rows[0]) {
    const result = await query(
      `
        update lms_enrollments
        set status = $3,
            completed_at = case when $3 = 'completed' then now() else null end,
            metadata = $4
        where user_id = $1 and course_id = $2
        returning *
      `,
      [
        payload.userId,
        payload.courseId,
        payload.status,
        JSON.stringify(payload.metadata ?? {}),
      ],
    );

    const enrollment = mapEnrollmentRow(result.rows[0]);
    await createAuditLog(
      "enrollment",
      enrollment.id,
      "re-activated",
      "info",
      "Enrollment already existed and was refreshed",
      { userId: enrollment.userId, courseId: enrollment.courseId },
    );
    return enrollment;
  }

  const result = await query(
    `
      insert into lms_enrollments (user_id, course_id, status, metadata)
      values ($1, $2, $3, $4)
      returning *
    `,
    [
      payload.userId,
      payload.courseId,
      payload.status,
      JSON.stringify(payload.metadata ?? {}),
    ],
  );

  const enrollment = mapEnrollmentRow(result.rows[0]);
  await createAuditLog("enrollment", enrollment.id, "created", "info", "Enrollment created", {
    userId: enrollment.userId,
    courseId: enrollment.courseId,
  });
  return enrollment;
}

async function listEnrollments(filters) {
  const values = [];
  const where = [];

  if (filters.userId) {
    values.push(filters.userId);
    where.push(`user_id = $${values.length}`);
  }

  if (filters.courseId) {
    values.push(filters.courseId);
    where.push(`course_id = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    where.push(`status = $${values.length}`);
  }

  const whereClause = where.length ? `where ${where.join(" and ")}` : "";
  const result = await query(
    `select * from lms_enrollments ${whereClause} order by created_at desc`,
    values,
  );

  return result.rows.map(mapEnrollmentRow);
}

async function getEnrollmentById(enrollmentId) {
  const result = await query(`select * from lms_enrollments where id = $1`, [enrollmentId]);
  const row = result.rows[0];

  if (!row) {
    throw new AppError(404, "Enrollment not found");
  }

  return mapEnrollmentRow(row);
}

async function updateEnrollment(enrollmentId, payload) {
  const current = await getEnrollmentById(enrollmentId);
  const nextStatus = payload.status ?? current.status;
  const nextCompletedAt =
    payload.completedAt === undefined
      ? nextStatus === "completed"
        ? current.completedAt ?? new Date().toISOString()
        : null
      : payload.completedAt;

  const result = await query(
    `
      update lms_enrollments
      set status = $2,
          completed_at = $3,
          metadata = $4
      where id = $1
      returning *
    `,
    [
      enrollmentId,
      nextStatus,
      nextCompletedAt,
      JSON.stringify(payload.metadata ?? current.metadata ?? {}),
    ],
  );

  const enrollment = mapEnrollmentRow(result.rows[0]);
  await createAuditLog("enrollment", enrollment.id, "updated", "info", "Enrollment updated", {
    status: enrollment.status,
  });
  return enrollment;
}

async function cancelEnrollment(enrollmentId) {
  const result = await query(
    `
      update lms_enrollments
      set status = 'cancelled',
          completed_at = null
      where id = $1
      returning *
    `,
    [enrollmentId],
  );

  const row = result.rows[0];

  if (!row) {
    throw new AppError(404, "Enrollment not found");
  }

  const enrollment = mapEnrollmentRow(row);
  await createAuditLog("enrollment", enrollment.id, "cancelled", "warning", "Enrollment cancelled", {
    userId: enrollment.userId,
    courseId: enrollment.courseId,
  });
  return enrollment;
}

module.exports = {
  cancelEnrollment,
  createEnrollment,
  getEnrollmentById,
  listEnrollments,
  updateEnrollment,
};
