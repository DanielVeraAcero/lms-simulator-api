function isUniqueViolation(error) {
  return error && error.code === "23505";
}

module.exports = { isUniqueViolation };
