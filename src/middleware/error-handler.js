const { ZodError } = require("zod");

const { AppError } = require("../errors/app-error");
const { logger } = require("../config/logger");

function errorHandler(error, request, response, _next) {
  if (error instanceof ZodError) {
    return response.status(400).json({
      error: "ValidationError",
      message: "Request validation failed",
      details: error.flatten(),
    });
  }

  if (error instanceof AppError) {
    return response.status(error.statusCode).json({
      error: error.name,
      message: error.message,
      details: error.details,
    });
  }

  logger.error(
    {
      err: error,
      path: request.path,
      method: request.method,
    },
    "Unhandled application error",
  );

  return response.status(500).json({
    error: "InternalServerError",
    message: "An unexpected error occurred",
  });
}

module.exports = { errorHandler };
