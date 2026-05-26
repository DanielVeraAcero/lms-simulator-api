const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const { env } = require("./env");
const { logger } = require("./logger");

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseUrl.includes("supabase.co")
    ? { rejectUnauthorized: false }
    : false,
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function runSchemaIfNeeded() {
  if (!env.autoRunSchema) {
    logger.info("AUTO_RUN_SCHEMA disabled; skipping schema execution");
    return;
  }

  const schemaPath = path.join(process.cwd(), "sql", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  await pool.query(schemaSql);
  logger.info("Database schema verified");
}

module.exports = { pool, query, withTransaction, runSchemaIfNeeded };
