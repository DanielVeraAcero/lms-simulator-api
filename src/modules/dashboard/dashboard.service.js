const { query } = require("../../config/database");

function toNumber(value) {
  return Number.parseInt(value, 10) || 0;
}

function mapUserRow(row) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    externalContactId: row.external_contact_id,
    contactType: row.contact_type,
    status: row.status,
    enrollmentCount: toNumber(row.enrollment_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCourseRow(row) {
  return {
    id: row.id,
    courseCode: row.course_code,
    title: row.title,
    description: row.description,
    status: row.status,
    enrollmentCount: toNumber(row.enrollment_count),
    activeEnrollmentCount: toNumber(row.active_enrollment_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEnrollmentRow(row) {
  return {
    id: row.id,
    status: row.status,
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      id: row.user_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      contactType: row.contact_type,
      status: row.user_status,
    },
    course: {
      id: row.course_id,
      courseCode: row.course_code,
      title: row.title,
      status: row.course_status,
    },
  };
}

function mapAuditRow(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    level: row.level,
    message: row.message,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

async function getDashboardData() {
  const [summaryResult, usersResult, coursesResult, enrollmentsResult, auditResult] =
    await Promise.all([
      query(`
        select
          (select count(*) from lms_users) as users,
          (select count(*) from lms_courses) as courses,
          (select count(*) from lms_enrollments) as enrollments,
          (select count(*) from lms_enrollments where status = 'active') as active_enrollments
      `),
      query(`
        select
          users.*,
          count(enrollments.id) as enrollment_count
        from lms_users users
        left join lms_enrollments enrollments on enrollments.user_id = users.id
        group by users.id
        order by users.created_at desc
        limit 25
      `),
      query(`
        select
          courses.*,
          count(enrollments.id) as enrollment_count,
          count(enrollments.id) filter (where enrollments.status = 'active') as active_enrollment_count
        from lms_courses courses
        left join lms_enrollments enrollments on enrollments.course_id = courses.id
        group by courses.id
        order by courses.created_at desc
        limit 25
      `),
      query(`
        select
          enrollments.*,
          users.email,
          users.first_name,
          users.last_name,
          users.contact_type,
          users.status as user_status,
          courses.course_code,
          courses.title,
          courses.status as course_status
        from lms_enrollments enrollments
        join lms_users users on users.id = enrollments.user_id
        join lms_courses courses on courses.id = enrollments.course_id
        order by enrollments.created_at desc
        limit 50
      `),
      query(`
        select *
        from audit_logs
        order by created_at desc
        limit 20
      `),
    ]);

  const summary = summaryResult.rows[0];

  return {
    summary: {
      users: toNumber(summary.users),
      courses: toNumber(summary.courses),
      enrollments: toNumber(summary.enrollments),
      activeEnrollments: toNumber(summary.active_enrollments),
    },
    users: usersResult.rows.map(mapUserRow),
    courses: coursesResult.rows.map(mapCourseRow),
    enrollments: enrollmentsResult.rows.map(mapEnrollmentRow),
    auditLogs: auditResult.rows.map(mapAuditRow),
  };
}

module.exports = { getDashboardData };
