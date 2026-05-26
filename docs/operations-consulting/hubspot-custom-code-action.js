const axios = require("axios");

const LMS_BASE_URL = process.env.LMS_BASE_URL;
const LMS_API_KEY = process.env.LMS_API_KEY;
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

const lmsClient = axios.create({
  baseURL: LMS_BASE_URL,
  timeout: 10000,
  headers: {
    Authorization: `Bearer ${LMS_API_KEY}`,
    "Content-Type": "application/json"
  }
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
      last_error: ""
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
        last_lms_sync_error: errorMessage
      });
    }

    if (enrollmentId) {
      await safeUpdateHubSpotEnrollment(enrollmentId, {
        sync_status: reviewStatus,
        last_attempt_at: new Date().toISOString(),
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
    first_name: firstName || "",
    last_name: lastName || "",
    status: "active"
  });

  return response.data;
}

async function findLmsUserByEmail(email) {
  const response = await lmsClient.get("/users", {
    params: { email }
  });

  const users = response.data.users || [];
  if (users.length > 1) {
    throw needsReview(`Multiple LMS users found for email ${email}.`);
  }

  return users[0] || null;
}

async function findOrCreateLmsEnrollment({ lmsUserId, lmsCourseId }) {
  const existingEnrollment = await findLmsEnrollment({ lmsUserId, lmsCourseId });
  if (existingEnrollment) return existingEnrollment;

  const response = await lmsClient.post("/enrollments", {
    user_id: lmsUserId,
    course_id: lmsCourseId,
    status: "active"
  });

  return response.data;
}

async function findLmsEnrollment({ lmsUserId, lmsCourseId }) {
  const response = await lmsClient.get("/enrollments", {
    params: {
      user_id: lmsUserId,
      course_id: lmsCourseId
    }
  });

  const enrollments = response.data.enrollments || [];
  return enrollments[0] || null;
}

async function updateHubSpotContact(contactId, properties) {
  await hubspotClient.patch(`/crm/v3/objects/contacts/${contactId}`, {
    properties
  });
}

async function updateHubSpotEnrollment(enrollmentId, properties) {
  await hubspotClient.patch(`/crm/v3/objects/enrollments/${enrollmentId}`, {
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
