import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const { mockVerifyAccessToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
}));

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

vi.mock("../../utils/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/index.js")>();
  return { ...actual, verifyAccessToken: mockVerifyAccessToken };
});

import { authenticate } from "../authenticate.js";
import { UnauthorizedError } from "../../utils/errors.js";

function mockReq(authHeader?: string): Partial<Request> & { headers: Record<string, string>; user?: unknown } {
  return { headers: authHeader ? { authorization: authHeader } : {} };
}

function mockRes(): Response {
  return {} as Response;
}

describe("middleware/authenticate.ts", () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("calls next(UnauthorizedError) when Authorization header is missing", () => {
    const req = mockReq();
    authenticate(req as Request, mockRes(), next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const arg = next.mock.calls[0][0];
    expect(arg).toBeInstanceOf(UnauthorizedError);
  });

  it("calls next(UnauthorizedError) when header does not start with 'Bearer '", () => {
    const req = mockReq("Token some-token");
    authenticate(req as Request, mockRes(), next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const arg = next.mock.calls[0][0];
    expect(arg).toBeInstanceOf(UnauthorizedError);
  });

  it("calls next(err) when verifyAccessToken throws", () => {
    const error = new UnauthorizedError("Invalid or expired access token");
    mockVerifyAccessToken.mockImplementation(() => { throw error; });

    const req = mockReq("Bearer bad-token");
    authenticate(req as Request, mockRes(), next as NextFunction);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("attaches decoded payload to req.user and calls next() on valid token", () => {
    const payload = { sub: "user-1", email: "a@b.com", permissions: ["user:read"] };
    mockVerifyAccessToken.mockReturnValue(payload);

    const req = mockReq("Bearer valid-token");
    authenticate(req as Request, mockRes(), next as NextFunction);

    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalledWith();
  });

  it("passes the extracted token string to verifyAccessToken", () => {
    const payload = { sub: "user-1", email: "a@b.com", permissions: [] };
    mockVerifyAccessToken.mockReturnValue(payload);

    const req = mockReq("Bearer my-token-value");
    authenticate(req as Request, mockRes(), next as NextFunction);

    expect(mockVerifyAccessToken).toHaveBeenCalledWith("my-token-value");
  });
});
