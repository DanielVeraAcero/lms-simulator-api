const { query } = require("../../config/database");
const { AppError } = require("../../errors/app-error");
const { isUniqueViolation } = require("../../utils/pg-error");
const { createAuditLog } = require("../audit/audit.service");

function mapCourseRow(row) {
  return {
    id: row.id,
    courseCode: row.course_code,
    title: row.title,
    description: row.description,
    status: row.status,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createCourse(payload) {
  try {
    const result = await query(
      `
        insert into lms_courses (course_code, title, description, status, metadata)
        values ($1, $2, $3, $4, $5)
        returning *
      `,
      [
        payload.courseCode,
        payload.title,
        payload.description ?? null,
        payload.status,
        JSON.stringify(payload.metadata ?? {}),
      ],
    );

    const course = mapCourseRow(result.rows[0]);
    await createAuditLog("course", course.id, "created", "info", "Course created", {
      courseCode: course.courseCode,
    });
    return course;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "A course with this code already exists");
    }

    throw error;
  }
}

async function listCourses(filters) {
  const values = [];
  const where = [];

  if (filters.status) {
    values.push(filters.status);
    where.push(`status = $${values.length}`);
  }

  const whereClause = where.length ? `where ${where.join(" and ")}` : "";
  const result = await query(
    `select * from lms_courses ${whereClause} order by created_at desc`,
    values,
  );

  return result.rows.map(mapCourseRow);
}

async function getCourseById(courseId) {
  const result = await query(`select * from lms_courses where id = $1`, [courseId]);
  const row = result.rows[0];

  if (!row) {
    throw new AppError(404, "Course not found");
  }

  return mapCourseRow(row);
}

async function updateCourse(courseId, payload) {
  const current = await getCourseById(courseId);
  const next = {
    courseCode: payload.courseCode ?? current.courseCode,
    title: payload.title ?? current.title,
    description:
      payload.description === undefined ? current.description : payload.description,
    status: payload.status ?? current.status,
    metadata: payload.metadata ?? current.metadata,
  };

  try {
    const result = await query(
      `
        update lms_courses
        set course_code = $2,
            title = $3,
            description = $4,
            status = $5,
            metadata = $6
        where id = $1
        returning *
      `,
      [
        courseId,
        next.courseCode,
        next.title,
        next.description,
        next.status,
        JSON.stringify(next.metadata ?? {}),
      ],
    );

    const course = mapCourseRow(result.rows[0]);
    await createAuditLog("course", course.id, "updated", "info", "Course updated", {
      courseCode: course.courseCode,
    });
    return course;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "A course with this code already exists");
    }

    throw error;
  }
}

async function archiveCourse(courseId) {
  const result = await query(
    `
      update lms_courses
      set status = 'archived'
      where id = $1
      returning *
    `,
    [courseId],
  );

  const row = result.rows[0];

  if (!row) {
    throw new AppError(404, "Course not found");
  }

  const course = mapCourseRow(row);
  await createAuditLog("course", course.id, "archived", "warning", "Course archived", {
    courseCode: course.courseCode,
  });
  return course;
}

module.exports = {
  archiveCourse,
  createCourse,
  getCourseById,
  listCourses,
  updateCourse,
};
