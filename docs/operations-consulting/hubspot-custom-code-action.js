const axios = require("axios");

const LMS_BASE_URL = process.env.LMS_BASE_URL;
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const HUBSPOT_ENROLLMENT_OBJECT_TYPE =
  process.env.HUBSPOT_ENROLLMENT_OBJECT_TYPE || "2-63145867";

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

  const contactId = input.contact_id;
  const enrollmentId = input.enrollment_id;
  const email = normalizeEmail(input.email);
  const firstName = input.firstname;
  const lastName = input.lastname;
  const lmsCourseId = input.lms_course_id;
  const existingLmsUserId = input.lms_user_id;

  try {
    validateRequiredInput({ contactId, enrollmentId, email, lmsCourseId });

    const user = existingLmsUserId
      ? { id: existingLmsUserId }
      : await findOrCreateLmsUser({ email, firstName, lastName });

    await updateHubSpotContact(contactId, {
      lms_user_id: user.id,
      lms_sync_status: "Pending",
      last_lms_sync_at: new Date().toISOString(),
      last_lms_sync_error: ""
    });

    const enrollment = await findOrCreateLmsEnrollment({
      lmsUserId: user.id,
      lmsCourseId
    });

    await updateHubSpotEnrollment(enrollmentId, {
      lms_enrollment_id: enrollment.id,
      sync_status: "Synced",
      last_attempt_at: new Date().toISOString(),
      retry_count: 0,
      last_error: ""
    });

    await updateHubSpotContact(contactId, {
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
      ? "Needs Review"
      : "Error";

    if (contactId) {
      await safeUpdateHubSpotContact(contactId, {
        lms_sync_status: reviewStatus,
        last_lms_sync_at: new Date().toISOString(),
        last_lms_sync_error: errorMessage
      });
    }

    if (enrollmentId) {
      const retryCount = incrementRetryCount(input.retry_count);
      await safeUpdateHubSpotEnrollment(enrollmentId, {
        sync_status: reviewStatus,
        last_attempt_at: new Date().toISOString(),
        retry_count: retryCount,
        last_error: errorMessage
      });
    }

    callback({
      outputFields: {
        success: false,
        lms_user_id: existingLmsUserId || "",
        lms_enrollment_id: "",
        error_message: errorMessage
      }
    });
  }
};

function validateRequiredInput({ contactId, enrollmentId, email, lmsCourseId }) {
  if (!contactId) throw needsReview("Missing HubSpot contact ID.");
  if (!enrollmentId) throw needsReview("Missing HubSpot enrollment ID.");
  if (!email) throw needsReview("Missing student email.");
  if (!lmsCourseId) throw needsReview("Missing LMS course ID.");
}

async function findOrCreateLmsUser({ email, firstName, lastName }) {
  const existingUser = await findLmsUserByEmail(email);
  if (existingUser) return existingUser;

  const response = await lmsClient.post("/users", {
    email,
    firstName: firstName || "Unknown",
    lastName: lastName || "Unknown",
    contactType: "student",
    status: "active"
  });

  return unwrapRecord(response, "user");
}

async function findLmsUserByEmail(email) {
  const response = await lmsClient.get("/users", {
    params: { email }
  });

  const users = unwrapCollection(response, "users");
  if (users.length > 1) {
    throw needsReview(`Multiple LMS users found for email ${email}.`);
  }

  return users[0] || null;
}

async function findOrCreateLmsEnrollment({ lmsUserId, lmsCourseId }) {
  const existingEnrollment = await findLmsEnrollment({ lmsUserId, lmsCourseId });
  if (existingEnrollment) return existingEnrollment;

  const response = await lmsClient.post("/enrollments", {
    userId: lmsUserId,
    courseId: lmsCourseId,
    status: "active"
  });

  return unwrapRecord(response, "enrollment");
}

async function findLmsEnrollment({ lmsUserId, lmsCourseId }) {
  const response = await lmsClient.get("/enrollments", {
    params: {
      userId: lmsUserId,
      courseId: lmsCourseId
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
