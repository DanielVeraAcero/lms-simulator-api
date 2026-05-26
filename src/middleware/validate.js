function validate(schema, source = "body") {
  return (request, _response, next) => {
    const parsed = schema.parse(request[source]);
    request[source] = parsed;
    next();
  };
}

module.exports = { validate };
