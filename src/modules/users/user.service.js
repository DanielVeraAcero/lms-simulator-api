const { query } = require("../../config/database");
const { AppError } = require("../../errors/app-error");
const { isUniqueViolation } = require("../../utils/pg-error");
const { createAuditLog } = require("../audit/audit.service");

function mapUserRow(row) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    externalContactId: row.external_contact_id,
    contactType: row.contact_type,
    status: row.status,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createUser(payload) {
  try {
    const result = await query(
      `
        insert into lms_users (
          email, first_name, last_name, external_contact_id, contact_type, status, metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning *
      `,
      [
        payload.email.toLowerCase(),
        payload.firstName,
        payload.lastName,
        payload.externalContactId ?? null,
        payload.contactType,
        payload.status,
        JSON.stringify(payload.metadata ?? {}),
      ],
    );

    const user = mapUserRow(result.rows[0]);
    await createAuditLog("user", user.id, "created", "info", "User created", { email: user.email });
    return user;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "A user with this email already exists");
    }

    throw error;
  }
}

async function listUsers(filters) {
  const conditions = [];
  const values = [];

  if (filters.email) {
    values.push(filters.email.toLowerCase());
    conditions.push(`lower(email) = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }

  if (filters.contactType) {
    values.push(filters.contactType);
    conditions.push(`contact_type = $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";

  const result = await query(
    `select * from lms_users ${whereClause} order by created_at desc`,
    values,
  );

  return result.rows.map(mapUserRow);
}

async function getUserById(userId) {
  const result = await query(`select * from lms_users where id = $1`, [userId]);
  const row = result.rows[0];

  if (!row) {
    throw new AppError(404, "User not found");
  }

  return mapUserRow(row);
}

async function updateUser(userId, payload) {
  const current = await getUserById(userId);
  const next = {
    email: payload.email?.toLowerCase() ?? current.email,
    firstName: payload.firstName ?? current.firstName,
    lastName: payload.lastName ?? current.lastName,
    externalContactId:
      payload.externalContactId === undefined
        ? current.externalContactId
        : payload.externalContactId,
    contactType: payload.contactType ?? current.contactType,
    status: payload.status ?? current.status,
    metadata: payload.metadata ?? current.metadata,
  };

  try {
    const result = await query(
      `
        update lms_users
        set email = $2,
            first_name = $3,
            last_name = $4,
            external_contact_id = $5,
            contact_type = $6,
            status = $7,
            metadata = $8
        where id = $1
        returning *
      `,
      [
        userId,
        next.email,
        next.firstName,
        next.lastName,
        next.externalContactId,
        next.contactType,
        next.status,
        JSON.stringify(next.metadata ?? {}),
      ],
    );

    const user = mapUserRow(result.rows[0]);
    await createAuditLog("user", user.id, "updated", "info", "User updated", { email: user.email });
    return user;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "A user with this email already exists");
    }

    throw error;
  }
}

async function archiveUser(userId) {
  const result = await query(
    `
      update lms_users
      set status = 'archived'
      where id = $1
      returning *
    `,
    [userId],
  );

  const row = result.rows[0];

  if (!row) {
    throw new AppError(404, "User not found");
  }

  const user = mapUserRow(row);
  await createAuditLog("user", user.id, "archived", "warning", "User archived", { email: user.email });
  return user;
}

module.exports = {
  archiveUser,
  createUser,
  getUserById,
  listUsers,
  updateUser,
};
