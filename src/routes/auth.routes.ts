import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  register,
  login,
  refresh,
  changePassword,
  requestPasswordReset,
  resetPassword,
} from "../services/auth.service.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "../validators/auth.validators.js";
import { sendSuccess } from "../utils/response.js";

const router = Router();

router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const user = await register(req.body);
    sendSuccess(res, user, 201);
  }),
);

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await login(req.body);
    sendSuccess(res, result, 200);
  }),
);

router.post(
  "/refresh",
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const result = await refresh(req.body.token);
    sendSuccess(res, result, 200);
  }),
);

router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await changePassword(req.user!.sub, req.body);
    sendSuccess(res);
  }),
);

router.post(
  "/reset-password",
  validate(requestPasswordResetSchema),
  asyncHandler(async (req, res) => {
    const result = await requestPasswordReset(req.body.email);
    sendSuccess(res, result);
  }),
);

router.post(
  "/reset-password/confirm",
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await resetPassword(req.body);
    sendSuccess(res);
  }),
);

export default router;
