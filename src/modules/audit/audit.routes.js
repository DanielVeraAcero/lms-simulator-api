const { Router } = require("express");

const { asyncHandler } = require("../../utils/async-handler");
const { listAuditLogs } = require("./audit.service");

const router = Router();

router.get(
  "/",
  asyncHandler(async (_request, response) => {
    const logs = await listAuditLogs();
    response.json({ data: logs });
  }),
);

module.exports = { auditRouter: router };
