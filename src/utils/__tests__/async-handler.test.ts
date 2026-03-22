import { describe, it, expect, vi, beforeEach } from "vitest";
import { asyncHandler } from "../async-handler.js";
import type { Request, Response, NextFunction } from "express";

describe("utils/async-handler.ts", () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReq = {} as Request;
    mockRes = {} as Response;
    mockNext = vi.fn();
  });

  it("calls the wrapped async function with req, res, next", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);

    wrapped(mockReq, mockRes, mockNext);

    // Allow microtask to settle
    await new Promise((r) => setTimeout(r, 0));

    expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
  });

  it("does not call next with error when handler resolves", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);

    wrapped(mockReq, mockRes, mockNext);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockNext).not.toHaveBeenCalled();
  });

  it("calls next with error when handler rejects", async () => {
    const error = new Error("async failure");
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);

    wrapped(mockReq, mockRes, mockNext);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockNext).toHaveBeenCalledWith(error);
  });
});
