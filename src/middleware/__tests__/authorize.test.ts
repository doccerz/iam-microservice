import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "../../types/index.js";

vi.mock("../../config/env.js", () => ({
  env: {
    JWT_ACCESS_SECRET: "test-access-secret",
    JWT_REFRESH_SECRET: "test-refresh-secret",
    JWT_ACCESS_EXPIRY: "15m",
    JWT_REFRESH_EXPIRY: "7d",
    DATABASE_URL: "postgres://localhost/test",
    DATABASE_SCHEMA: "public",
    PORT: "3000",
    DEFAULT_ROLE_SLUG: "user",
  },
}));

import { authorize } from "../authorize.js";
import { ForbiddenError, UnauthorizedError } from "../../utils/errors.js";

function mockReq(permissions?: string[]): Partial<Request> {
  if (permissions === undefined) {
    return { headers: {} };
  }
  return {
    headers: {},
    user: { sub: "u1", email: "a@b.com", permissions } as JwtPayload,
  };
}

function mockRes(): Response {
  return {} as Response;
}

describe("middleware/authorize.ts", () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("calls next(UnauthorizedError) when req.user is undefined", () => {
    const req = mockReq(); // no user
    authorize("user:read")(req as Request, mockRes(), next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
  });

  it("calls next() when user has the single required permission", () => {
    const req = mockReq(["user:read"]);
    authorize("user:read")(req as Request, mockRes(), next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("calls next() when user has all of multiple required permissions", () => {
    const req = mockReq(["user:read", "user:write", "role:read"]);
    authorize("user:read", "user:write")(req as Request, mockRes(), next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("calls next(ForbiddenError) when user is missing one of two required permissions", () => {
    const req = mockReq(["user:read"]);
    authorize("user:read", "user:write")(req as Request, mockRes(), next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
  });

  it("calls next(ForbiddenError) when user has no permissions but one is required", () => {
    const req = mockReq([]);
    authorize("user:read")(req as Request, mockRes(), next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
  });

  it("calls next() when authorize is called with no required permissions", () => {
    const req = mockReq([]);
    authorize()(req as Request, mockRes(), next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });
});
