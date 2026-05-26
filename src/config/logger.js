const pino = require("pino");
const pinoHttp = require("pino-http");

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
});

const requestLogger = pinoHttp({ logger });

module.exports = { logger, requestLogger };
