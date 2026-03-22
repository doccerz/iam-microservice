import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../error-handler.js";
import {
  AppError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "../../utils/errors.js";

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const req = {} as Request;
const next = vi.fn() as NextFunction;

describe("errorHandler", () => {
  it("maps ConflictError to 409", () => {
    const res = mockRes();
    errorHandler(new ConflictError("Email already in use"), req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Email already in use" });
  });

  it("maps UnauthorizedError to 401", () => {
    const res = mockRes();
    errorHandler(new UnauthorizedError("Invalid credentials"), req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Invalid credentials" });
  });

  it("maps ForbiddenError to 403", () => {
    const res = mockRes();
    errorHandler(new ForbiddenError("Forbidden"), req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Forbidden" });
  });

  it("maps NotFoundError to 404", () => {
    const res = mockRes();
    errorHandler(new NotFoundError("Not found"), req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Not found" });
  });

  it("maps generic AppError with custom statusCode", () => {
    const res = mockRes();
    const err = new AppError("Custom error", 422);
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Custom error" });
  });

  it("maps unknown Error to 500", () => {
    const res = mockRes();
    errorHandler(new Error("Something broke"), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Internal server error" });
  });

  it("maps non-Error objects to 500", () => {
    const res = mockRes();
    errorHandler("string error" as unknown as Error, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Internal server error" });
  });
});
