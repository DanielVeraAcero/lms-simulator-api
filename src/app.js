const express = require("express");
const cors = require("cors");

const { requestLogger } = require("./config/logger");
const { errorHandler } = require("./middleware/error-handler");
const { notFoundHandler } = require("./middleware/not-found");
const { router } = require("./routes");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      service: "lms-simulator",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api", router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
