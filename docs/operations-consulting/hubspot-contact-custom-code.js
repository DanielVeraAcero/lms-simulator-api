const axios = require("axios");

const LMS_BASE_URL = process.env.LMS_BASE_URL;
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

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

// Sync a student Contact into the LMS user store.
// This action is intentionally self-contained: it validates the Contact,
// finds or creates the LMS user, then writes the sync result back to HubSpot.
exports.main = async (event, callback) => {
  const input = event.inputFields || {};
  const contactId = String(input.contact_id || "").trim();
  const email = normalizeEmail(input.email);
  const firstName = normalizeOptional(input.firstname);
  const lastName = normalizeOptional(input.lastname);
  const userType = normalizeOptional(input.user_type);
  const existingLmsUserId = normalizeOptional(input.lms_user_id);

  try {
    validateInput({ contactId, email, userType });

    const user = await findCreateOrUpdateLmsUser({
      existingLmsUserId,
      email,
      firstName,
      lastName
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
        error_message: ""
      }
    });
  } catch (error) {
    const errorMessage = formatError(error);
    const syncStatus = isNeedsReviewError(error) ? "Needs Review" : "Error";

    if (contactId) {
      await safeUpdateHubSpotContact(contactId, {
        lms_sync_status: syncStatus,
        last_lms_sync_at: new Date().toISOString(),
        last_lms_sync_error: errorMessage
      });
    }

    callback({
      outputFields: {
        success: false,
        lms_user_id: "",
        error_message: errorMessage
      }
    });
  }
};

function validateInput({ contactId, email, userType }) {
  if (!contactId) {
    throw needsReview("Missing HubSpot contact ID.");
  }

  if (!email) {
    throw needsReview("Missing student email.");
  }

  if (userType.toLowerCase() !== "student") {
    throw needsReview(`Contact is not a student. user_type=${userType}`);
  }
}

async function findCreateOrUpdateLmsUser({
  existingLmsUserId,
  email,
  firstName,
  lastName
}) {
  let user = null;

  // Prefer the stored LMS user ID when available so we can update the exact record.
  if (existingLmsUserId) {
    user = await getLmsUserById(existingLmsUserId);
  }

  // Fall back to email lookup when the LMS user ID is missing or stale.
  if (!user) {
    user = await findLmsUserByEmail(email);
  }

  // Create a new LMS user when no existing record matches.
  if (!user) {
    const response = await lmsClient.post("/api/users", {
      email,
      firstName: firstName || "Unknown",
      lastName: lastName || "Unknown",
      contactType: "student",
      status: "active"
    });

    return unwrapRecord(response);
  }

  const needsUpdate =
    normalizeEmail(user.email) !== email ||
    normalizeOptional(user.firstName) !== firstName ||
    normalizeOptional(user.lastName) !== lastName ||
    normalizeOptional(user.status) !== "active";

  // Keep LMS user data aligned with HubSpot when key fields change.
  if (!needsUpdate) {
    return user;
  }

  const response = await lmsClient.patch(`/api/users/${user.id}`, {
    email,
    firstName: firstName || "Unknown",
    lastName: lastName || "Unknown",
    contactType: "student",
    status: "active"
  });

  return unwrapRecord(response);
}

async function findLmsUserByEmail(email) {
  const response = await lmsClient.get("/api/users", {
    params: { email }
  });

  const users = unwrapCollection(response);
  if (users.length > 1) {
    throw needsReview(`Multiple LMS users found for email ${email}.`);
  }

  return users[0] || null;
}

async function getLmsUserById(userId) {
  try {
    const response = await lmsClient.get(`/api/users/${userId}`);
    return unwrapRecord(response);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }

    throw error;
  }
}

async function updateHubSpotContact(contactId, properties) {
  await hubspotClient.patch(`/crm/v3/objects/contacts/${contactId}`, {
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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
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
