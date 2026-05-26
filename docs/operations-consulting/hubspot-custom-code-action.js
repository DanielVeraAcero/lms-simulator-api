const axios = require("axios");

const LMS_BASE_URL = process.env.LMS_BASE_URL;
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const HUBSPOT_ENROLLMENT_OBJECT_TYPE =
  process.env.HUBSPOT_ENROLLMENT_OBJECT_TYPE || "2-63145867";
const HUBSPOT_COURSE_OBJECT_TYPE =
  process.env.HUBSPOT_COURSE_OBJECT_TYPE || "0-410";
const HUBSPOT_ENROLLMENT_SYNC_STATUS = {
  pending: "true",
  synced: "false",
  error: "Error",
  needsReview: "Needs Review",
  needsResync: "Needs Resync"
};

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

exports.main = async (event, callback) => {
  const input = event.inputFields || {};
  const enrollmentId = String(input.enrollment_id || "").trim();
  let resolvedContext = null;

  try {
    validateRequiredInput({ enrollmentId });

    const context = await loadEnrollmentContext(enrollmentId);
    resolvedContext = context;
    validateEnrollmentContext(context);

    const user = context.existingLmsUserId
      ? { id: context.existingLmsUserId }
      : await findOrCreateLmsUser({
          email: context.email,
          firstName: context.firstName,
          lastName: context.lastName
        });

    await updateHubSpotContact(context.contactId, {
      lms_user_id: user.id,
      lms_sync_status: "Pending",
      last_lms_sync_at: new Date().toISOString(),
      last_lms_sync_error: ""
    });

    const enrollment = await findOrCreateLmsEnrollment({
      lmsUserId: user.id,
      lmsCourseCode: context.lmsCourseCode
    });

    await updateHubSpotEnrollment(enrollmentId, {
      lms_enrollment_id: enrollment.id,
      sync_status: HUBSPOT_ENROLLMENT_SYNC_STATUS.synced,
      last_attempt_at: new Date().toISOString(),
      retry_count: 0,
      last_error: ""
    });

    await updateHubSpotContact(context.contactId, {
      lms_user_id: user.id,
      lms_sync_status: "Synced",
      last_lms_sync_at: new Date().toISOString(),
      last_lms_sync_error: ""
    });

    callback({
      outputFields: {
        success: true,
        lms_user_id: user.id,
        lms_enrollment_id: enrollment.id,
        error_message: ""
      }
    });
  } catch (error) {
    const errorMessage = formatError(error);
    const reviewStatus = isNeedsReviewError(error)
      ? HUBSPOT_ENROLLMENT_SYNC_STATUS.needsReview
      : HUBSPOT_ENROLLMENT_SYNC_STATUS.error;

    const safeContactId = resolvedContext
      ? resolvedContext.contactId
      : String(input.contact_id || "").trim();
    const safeEnrollmentId = String(input.enrollment_id || "").trim();
    const retryCount = incrementRetryCount(
      resolvedContext ? resolvedContext.retryCount : input.retry_count
    );

    if (safeContactId) {
      await safeUpdateHubSpotContact(safeContactId, {
        lms_sync_status: reviewStatus,
        last_lms_sync_at: new Date().toISOString(),
        last_lms_sync_error: errorMessage
      });
    }

    if (safeEnrollmentId) {
      await safeUpdateHubSpotEnrollment(safeEnrollmentId, {
        sync_status: reviewStatus,
        last_attempt_at: new Date().toISOString(),
        retry_count: retryCount,
        last_error: errorMessage
      });
    }

    callback({
      outputFields: {
        success: false,
        lms_user_id: "",
        lms_enrollment_id: "",
        error_message: errorMessage
      }
    });
  }
};

function validateRequiredInput({ enrollmentId }) {
  if (!enrollmentId) {
    throw needsReview("Missing HubSpot enrollment ID.");
  }
}

async function loadEnrollmentContext(enrollmentId) {
  const enrollmentRecord = await getHubSpotRecord(
    HUBSPOT_ENROLLMENT_OBJECT_TYPE,
    enrollmentId,
    ["retry_count", "sync_status", "enrollment_name"]
  );

  const contactId = await getSingleAssociationId(
    HUBSPOT_ENROLLMENT_OBJECT_TYPE,
    enrollmentId,
    "0-1",
    "contact"
  );

  const courseId = await getSingleAssociationId(
    HUBSPOT_ENROLLMENT_OBJECT_TYPE,
    enrollmentId,
    HUBSPOT_COURSE_OBJECT_TYPE,
    "course"
  );

  const contactRecord = await getHubSpotRecord(
    "contacts",
    contactId,
    ["email", "firstname", "lastname", "lms_user_id", "user_type"]
  );

  const courseRecord = await getHubSpotRecord(
    HUBSPOT_COURSE_OBJECT_TYPE,
    courseId,
    ["lms_course_id", "course_active", "course_code", "hs_course_name"]
  );

  return {
    enrollmentId,
    contactId,
    courseId,
    email: normalizeEmail(contactRecord.properties.email),
    firstName: normalizeOptional(contactRecord.properties.firstname),
    lastName: normalizeOptional(contactRecord.properties.lastname),
    existingLmsUserId: normalizeOptional(contactRecord.properties.lms_user_id),
    userType: normalizeOptional(contactRecord.properties.user_type),
    lmsCourseCode:
      normalizeOptional(courseRecord.properties.lms_course_id) ||
      normalizeOptional(courseRecord.properties.course_code),
    courseActive: normalizeOptional(courseRecord.properties.course_active),
    retryCount: enrollmentRecord.properties.retry_count
  };
}

function validateEnrollmentContext(context) {
  if (!context.contactId) {
    throw needsReview("Enrollment is missing an associated contact.");
  }

  if (!context.courseId) {
    throw needsReview("Enrollment is missing an associated course.");
  }

  if (!context.email) {
    throw needsReview("Missing student email.");
  }

  if (!context.lmsCourseCode) {
    throw needsReview("Missing LMS course ID.");
  }

  const normalizedUserType = context.userType.toLowerCase();
  if (normalizedUserType && normalizedUserType !== "student") {
    throw needsReview(`Associated contact is not a student. user_type=${context.userType}`);
  }

  if (context.courseActive.toLowerCase() === "false") {
    throw needsReview("Associated course is inactive.");
  }
}

async function getHubSpotRecord(objectType, recordId, properties) {
  const response = await hubspotClient.get(`/crm/v3/objects/${objectType}/${recordId}`, {
    params: {
      properties: properties.join(",")
    }
  });

  return response.data;
}

async function getSingleAssociationId(fromObjectType, fromRecordId, toObjectType, label) {
  const response = await hubspotClient.get(
    `/crm/v4/objects/${fromObjectType}/${fromRecordId}/associations/${toObjectType}`
  );

  const results = response.data.results || [];

  if (!results.length) {
    throw needsReview(`Enrollment is missing an associated ${label}.`);
  }

  if (results.length > 1) {
    throw needsReview(`Enrollment has multiple associated ${label} records.`);
  }

  return String(results[0].toObjectId);
}

async function findOrCreateLmsUser({ email, firstName, lastName }) {
  const existingUser = await findLmsUserByEmail(email);
  if (existingUser) {
    return existingUser;
  }

  const response = await lmsClient.post("/api/users", {
    email,
    firstName: firstName || "Unknown",
    lastName: lastName || "Unknown",
    contactType: "student",
    status: "active"
  });

  return unwrapRecord(response, "user");
}

async function findLmsUserByEmail(email) {
  const response = await lmsClient.get("/api/users", {
    params: { email }
  });

  const users = unwrapCollection(response, "users");
  if (users.length > 1) {
    throw needsReview(`Multiple LMS users found for email ${email}.`);
  }

  return users[0] || null;
}

async function findOrCreateLmsEnrollment({ lmsUserId, lmsCourseCode }) {
  const existingEnrollment = await findLmsEnrollment({ lmsUserId, lmsCourseCode });
  if (existingEnrollment) {
    return existingEnrollment;
  }

  const response = await lmsClient.post("/api/enrollments", {
    userId: lmsUserId,
    courseCode: lmsCourseCode,
    status: "active"
  });

  return unwrapRecord(response, "enrollment");
}

async function findLmsEnrollment({ lmsUserId, lmsCourseCode }) {
  const response = await lmsClient.get("/api/enrollments", {
    params: {
      userId: lmsUserId,
      courseCode: lmsCourseCode
    }
  });

  const enrollments = unwrapCollection(response, "enrollments");
  return enrollments[0] || null;
}

async function updateHubSpotContact(contactId, properties) {
  await hubspotClient.patch(`/crm/v3/objects/contacts/${contactId}`, {
    properties
  });
}

async function updateHubSpotEnrollment(enrollmentId, properties) {
  await hubspotClient.patch(`/crm/v3/objects/${HUBSPOT_ENROLLMENT_OBJECT_TYPE}/${enrollmentId}`, {
    properties
  });
}

async function safeUpdateHubSpotContact(contactId, properties) {
  try {
    await updateHubSpotContact(contactId, properties);
  } catch (error) {
    console.log(`Failed to update HubSpot contact ${contactId}: ${formatError(error)}`);
  }
}

async function safeUpdateHubSpotEnrollment(enrollmentId, properties) {
  try {
    await updateHubSpotEnrollment(enrollmentId, properties);
  } catch (error) {
    console.log(`Failed to update HubSpot enrollment ${enrollmentId}: ${formatError(error)}`);
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeOptional(value) {
  return String(value || "").trim();
}

function incrementRetryCount(retryCount) {
  const current = Number(retryCount || 0);
  return Number.isFinite(current) ? current + 1 : 1;
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

function unwrapCollection(response, label) {
  const payload = response.data || {};

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  if (Array.isArray(payload[label])) {
    return payload[label];
  }

  return [];
}

function unwrapRecord(response, label) {
  const payload = response.data || {};

  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload[label] && typeof payload[label] === "object" && !Array.isArray(payload[label])) {
    return payload[label];
  }

  return payload;
}
