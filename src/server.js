const { createApp } = require("./app");
const { env } = require("./config/env");
const { logger } = require("./config/logger");
const { pool, runSchemaIfNeeded } = require("./config/database");

async function startServer() {
  try {
    await runSchemaIfNeeded();

    const app = createApp();
    app.listen(env.port, () => {
      logger.info({ port: env.port }, "LMS simulator listening");
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to start server");
    await pool.end();
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info({ signal }, "Shutting down LMS simulator");
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
