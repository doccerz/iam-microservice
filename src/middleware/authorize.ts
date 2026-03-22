import type { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/index.js";

export function authorize(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError("Not authenticated"));
      return;
    }
    const hasAll = requiredPermissions.every(p => req.user!.permissions.includes(p));
    if (!hasAll) {
      next(new ForbiddenError("Insufficient permissions"));
      return;
    }
    next();
  };
}
