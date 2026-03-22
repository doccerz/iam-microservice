import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { register, login } from "../services/auth.service.js";
import { registerSchema, loginSchema } from "../validators/auth.validators.js";
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

export default router;
