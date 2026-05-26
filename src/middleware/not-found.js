function notFoundHandler(request, response) {
  response.status(404).json({
    error: "NotFound",
    message: `Route ${request.method} ${request.path} does not exist`,
  });
}

module.exports = { notFoundHandler };
