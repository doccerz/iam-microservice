import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/index.js";

export function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(", ");
      sendError(res, message, 400);
      return;
    }
    req.body = result.data;
    next();
  };
}
