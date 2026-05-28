const axios = require("axios");

const LMS_BASE_URL = process.env.LMS_BASE_URL;
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const HUBSPOT_COURSE_OBJECT_TYPE =
  process.env.HUBSPOT_COURSE_OBJECT_TYPE || "0-410";

const lmsHeaders = {
  "Content-Type": "application/json"
};

if (process.env.LMS_API_KEY) {
  lmsHeaders.Authorization = `Bearer ${process.env.LMS_API_KEY}`;
}

const lmsClient = axios.create({
  baseURL: LMS_BASE_URL,
  timeout: 10000,
  headers: lmsHeaders
});

const hubspotClient = axios.create({
  baseURL: "https://api.hubapi.com",
  timeout: 10000,
  headers: {
    Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
    "Content-Type": "application/json"
  }
});

// Sync a Course record into the LMS course catalog.
// This action handles both initial creation and later updates such as title changes.
exports.main = async (event, callback) => {
  const input = event.inputFields || {};
  const courseId = String(input.course_id || "").trim();
  const courseCode = normalizeOptional(input.course_code);
  const courseName = normalizeOptional(input.hs_course_name);
  const courseActive = normalizeOptional(input.course_active);
  const existingLmsCourseId = normalizeOptional(input.lms_course_id);

  try {
    validateInput({ courseId, courseCode, courseName, courseActive });

    const course = await findCreateOrUpdateLmsCourse({
      existingLmsCourseId,
      courseCode,
      courseName
    });

    await updateHubSpotCourse(courseId, {
      lms_course_id: course.courseCode || course.id,
      lms_sync_status: "Synced",
      last_lms_sync_at: new Date().toISOString(),
      last_lms_sync_error: ""
    });

    callback({
      outputFields: {
        success: true,
        lms_course_id: course.courseCode || course.id,
        error_message: ""
      }
    });
  } catch (error) {
    const errorMessage = formatError(error);
    const syncStatus = isNeedsReviewError(error) ? "Needs Review" : "Error";

    if (courseId) {
      await safeUpdateHubSpotCourse(courseId, {
        lms_sync_status: syncStatus,
        last_lms_sync_at: new Date().toISOString(),
        last_lms_sync_error: errorMessage
      });
    }

    callback({
      outputFields: {
        success: false,
        lms_course_id: "",
        error_message: errorMessage
      }
    });
  }
};

function validateInput({ courseId, courseCode, courseName, courseActive }) {
  if (!courseId) {
    throw needsReview("Missing HubSpot course ID.");
  }

  if (!/^\d+$/.test(courseId)) {
    throw needsReview(`course_id must be the numeric HubSpot Record ID. Received: ${courseId}`);
  }

  if (!courseCode) {
    throw needsReview("Missing course code.");
  }

  if (!courseName) {
    throw needsReview("Missing course name.");
  }

  if (courseActive.toLowerCase() === "false") {
    throw needsReview("Course is inactive.");
  }
}

async function findCreateOrUpdateLmsCourse({
  existingLmsCourseId,
  courseCode,
  courseName
}) {
  let course = null;

  // Prefer the stored LMS course identifier when available.
  // In this setup the HubSpot LMS course field stores the external course code.
  if (existingLmsCourseId) {
    course = await findLmsCourseByCode(existingLmsCourseId);
  }

  // Fall back to the HubSpot course code to locate the LMS course.
  if (!course) {
    course = await findLmsCourseByCode(courseCode);
  }

  // Create a new LMS course when it does not exist yet.
  if (!course) {
    const response = await lmsClient.post("/api/courses", {
      courseCode,
      title: courseName,
      status: "published"
    });

    return unwrapRecord(response);
  }

  const needsUpdate =
    normalizeOptional(course.courseCode) !== courseCode ||
    normalizeOptional(course.title) !== courseName ||
    normalizeOptional(course.status) !== "published";

  // Update the LMS course when the HubSpot record changes.
  if (!needsUpdate) {
    return course;
  }

  const response = await lmsClient.patch(`/api/courses/${course.id}`, {
    courseCode,
    title: courseName,
    status: "published"
  });

  return unwrapRecord(response);
}

async function findLmsCourseByCode(courseCode) {
  const response = await lmsClient.get("/api/courses", {
    params: { courseCode }
  });

  const courses = unwrapCollection(response);
  if (courses.length > 1) {
    throw needsReview(`Multiple LMS courses found for course code ${courseCode}.`);
  }

  return courses[0] || null;
}

async function updateHubSpotCourse(courseId, properties) {
  await hubspotClient.patch(`/crm/v3/objects/${HUBSPOT_COURSE_OBJECT_TYPE}/${courseId}`, {
    properties
  });
}

async function safeUpdateHubSpotCourse(courseId, properties) {
  try {
    await updateHubSpotCourse(courseId, properties);
  } catch (error) {
    console.log(`Failed to update HubSpot course ${courseId}: ${formatError(error)}`);
  }
}

function normalizeOptional(value) {
  return String(value || "").trim();
}

function needsReview(message) {
  const error = new Error(message);
  error.needsReview = true;
  return error;
}

function isNeedsReviewError(error) {
  return Boolean(error && error.needsReview);
}

function formatError(error) {
  if (error.response) {
    const status = error.response.status;
    const body = JSON.stringify(error.response.data || {});
    return `API error ${status}: ${body}`;
  }

  return error.message || "Unknown sync error.";
}

function unwrapCollection(response) {
  const payload = response.data || {};
  return Array.isArray(payload.data) ? payload.data : [];
}

function unwrapRecord(response) {
  const payload = response.data || {};
  return payload.data || payload;
}
