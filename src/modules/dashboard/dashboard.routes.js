const { Router } = require("express");

const { asyncHandler } = require("../../utils/async-handler");
const { getDashboardData } = require("./dashboard.service");

const router = Router();

router.get(
  "/",
  asyncHandler(async (_request, response) => {
    const dashboard = await getDashboardData();
    response.json({ data: dashboard });
  }),
);

module.exports = { dashboardRouter: router };
