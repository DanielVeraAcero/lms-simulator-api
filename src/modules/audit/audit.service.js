const { query } = require("../../config/database");

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

async function createAuditLog(entityType, entityId, action, level, message, metadata = {}) {
  await query(
    `
      insert into audit_logs (entity_type, entity_id, action, level, message, metadata)
      values ($1, $2, $3, $4, $5, $6)
    `,
    [entityType, entityId, action, level, message, JSON.stringify(metadata)],
  );
}

async function listAuditLogs() {
  const result = await query(`select * from audit_logs order by created_at desc limit 200`);
  return result.rows.map(mapAuditRow);
}

module.exports = { createAuditLog, listAuditLogs };
