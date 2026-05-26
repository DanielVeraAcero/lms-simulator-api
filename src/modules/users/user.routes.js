const { Router } = require("express");
const { z } = require("zod");

const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/async-handler");
const {
  archiveUser,
  createUser,
  getUserById,
  listUsers,
  updateUser,
} = require("./user.service");
const { createUserSchema, updateUserSchema, userQuerySchema } = require("./user.schemas");

const router = Router();
const userIdParamSchema = z.object({ userId: z.string().uuid() });

router.post(
  "/",
  validate(createUserSchema),
  asyncHandler(async (request, response) => {
    const user = await createUser(request.body);
    response.status(201).json({ data: user });
  }),
);

router.get(
  "/",
  validate(userQuerySchema, "query"),
  asyncHandler(async (request, response) => {
    const users = await listUsers(request.query);
    response.json({ data: users });
  }),
);

router.get(
  "/:userId",
  validate(userIdParamSchema, "params"),
  asyncHandler(async (request, response) => {
    const user = await getUserById(request.params.userId);
    response.json({ data: user });
  }),
);

router.patch(
  "/:userId",
  validate(userIdParamSchema, "params"),
  validate(updateUserSchema),
  asyncHandler(async (request, response) => {
    const user = await updateUser(request.params.userId, request.body);
    response.json({ data: user });
  }),
);

router.delete(
  "/:userId",
  validate(userIdParamSchema, "params"),
  asyncHandler(async (request, response) => {
    const user = await archiveUser(request.params.userId);
    response.json({ data: user });
  }),
);

module.exports = { userRouter: router };
