import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

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

import { validate, validateQuery } from "../validate.js";

describe("middleware/validate.ts", () => {
  let mockReq: Partial<Request> & { body: unknown };
  let mockRes: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReq = { body: {} };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it("calls next() when body matches schema", () => {
    const schema = z.object({ name: z.string() });
    mockReq.body = { name: "Alice" };

    validate(schema)(mockReq as Request, mockRes as unknown as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledWith();
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("replaces req.body with parsed data on success", () => {
    const schema = z.object({ name: z.string().trim() });
    mockReq.body = { name: "  Alice  " };

    validate(schema)(mockReq as Request, mockRes as unknown as Response, mockNext as NextFunction);

    expect(mockReq.body).toEqual({ name: "Alice" });
  });

  it("writes transform output to req.body", () => {
    const schema = z.object({
      email: z.string().transform((v) => v.toLowerCase()),
    });
    mockReq.body = { email: "USER@EXAMPLE.COM" };

    validate(schema)(mockReq as Request, mockRes as unknown as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.body).toEqual({ email: "user@example.com" });
  });

  it("returns 400 when body is invalid", () => {
    const schema = z.object({ email: z.string().email() });
    mockReq.body = { email: "not-an-email" };

    validate(schema)(mockReq as Request, mockRes as unknown as Response, mockNext as NextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it("does not call next() on validation failure", () => {
    const schema = z.object({ email: z.string().email() });
    mockReq.body = { email: "bad" };

    validate(schema)(mockReq as Request, mockRes as unknown as Response, mockNext as NextFunction);

    expect(mockNext).not.toHaveBeenCalled();
  });

  it("includes all issue messages in the error string", () => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });
    mockReq.body = { email: "bad", password: "short" };

    validate(schema)(mockReq as Request, mockRes as unknown as Response, mockNext as NextFunction);

    const jsonArg = mockRes.json.mock.calls[0][0] as { error: string };
    expect(jsonArg.error).toContain("Invalid email");
    expect(jsonArg.error).toContain("8");
  });

  it("passes through when optional fields are absent", () => {
    const schema = z.object({
      name: z.string(),
      nickname: z.string().optional(),
    });
    mockReq.body = { name: "Alice" };

    validate(schema)(mockReq as Request, mockRes as unknown as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it("returns 400 on empty body against required-field schema", () => {
    const schema = z.object({ token: z.string() });
    mockReq.body = {};

    validate(schema)(mockReq as Request, mockRes as unknown as Response, mockNext as NextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe("validateQuery", () => {
  let mockReq: Partial<Request> & { query: Record<string, unknown> };
  let mockRes: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReq = { query: {} };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it("calls next() when query matches schema", () => {
    const schema = z.object({ page: z.coerce.number().default(1) });
    mockReq.query = { page: "2" };

    validateQuery(schema)(mockReq as unknown as Request, mockRes as unknown as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledWith();
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("writes coerced numbers to req.query", () => {
    const schema = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(20),
    });
    mockReq.query = { page: "3", limit: "50" };

    validateQuery(schema)(mockReq as unknown as Request, mockRes as unknown as Response, mockNext as NextFunction);

    expect((mockReq as unknown as Request).query).toEqual({ page: 3, limit: 50 });
  });

  it("applies defaults when query params are absent", () => {
    const schema = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(20),
    });
    mockReq.query = {};

    validateQuery(schema)(mockReq as unknown as Request, mockRes as unknown as Response, mockNext as NextFunction);

    expect((mockReq as unknown as Request).query).toMatchObject({ page: 1, limit: 20 });
  });

  it("transforms isActive string to boolean", () => {
    const schema = z.object({
      isActive: z.string().optional().transform((v) => (v === undefined ? undefined : v === "true")),
    });

    mockReq.query = { isActive: "true" };
    validateQuery(schema)(mockReq as unknown as Request, mockRes as unknown as Response, mockNext as NextFunction);
    expect((mockReq as unknown as Request).query).toMatchObject({ isActive: true });

    mockReq.query = { isActive: "false" };
    validateQuery(schema)(mockReq as unknown as Request, mockRes as unknown as Response, mockNext as NextFunction);
    expect((mockReq as unknown as Request).query).toMatchObject({ isActive: false });
  });

  it("returns 400 when query is invalid", () => {
    const schema = z.object({ page: z.coerce.number().int().positive() });
    mockReq.query = { page: "-1" };

    validateQuery(schema)(mockReq as unknown as Request, mockRes as unknown as Response, mockNext as NextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it("does not call next() on validation failure", () => {
    const schema = z.object({ page: z.coerce.number().int().positive() });
    mockReq.query = { page: "0" };

    validateQuery(schema)(mockReq as unknown as Request, mockRes as unknown as Response, mockNext as NextFunction);

    expect(mockNext).not.toHaveBeenCalled();
  });
});
