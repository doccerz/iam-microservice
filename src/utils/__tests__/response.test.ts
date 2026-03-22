import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendSuccess, sendError } from "../response.js";

describe("utils/response.ts", () => {
  let mockRes: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
  });

  describe("sendSuccess()", () => {
    it("sends { success: true, data } with status 200 by default", () => {
      sendSuccess(mockRes as any, { id: 1 });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 1 },
      });
    });

    it("uses custom statusCode when provided", () => {
      sendSuccess(mockRes as any, { id: 1 }, 201);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it("omits data field when data is undefined", () => {
      sendSuccess(mockRes as any);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe("sendError()", () => {
    it("sends { success: false, error } with status 500 by default", () => {
      sendError(mockRes as any, "Something went wrong");

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Something went wrong",
      });
    });

    it("uses custom statusCode when provided", () => {
      sendError(mockRes as any, "Bad request", 400);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
