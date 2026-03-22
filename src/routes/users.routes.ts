import { Router } from "express";
import { validate, validateQuery } from "../middleware/validate.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { asyncHandler, sendSuccess } from "../utils/index.js";
import { createUser, listUsers, updateUser, updateUserRoles } from "../services/users.service.js";
import {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  updateUserRolesSchema,
} from "../validators/users.validators.js";
import type { ListUsersInput } from "../validators/users.validators.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("user:write"),
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const user = await createUser(req.body);
    sendSuccess(res, user, 201);
  }),
);

router.get(
  "/",
  authenticate,
  authorize("user:read"),
  validateQuery(listUsersSchema),
  asyncHandler(async (req, res) => {
    const result = await listUsers(req.query as unknown as ListUsersInput);
    sendSuccess(res, result);
  }),
);

router.patch(
  "/:id",
  authenticate,
  authorize("user:write"),
  validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    const user = await updateUser(req.params.id as string, req.body);
    sendSuccess(res, user);
  }),
);

router.put(
  "/:id/roles",
  authenticate,
  authorize("role:write"),
  validate(updateUserRolesSchema),
  asyncHandler(async (req, res) => {
    await updateUserRoles(req.params.id as string, req.body);
    sendSuccess(res);
  }),
);

export default router;
