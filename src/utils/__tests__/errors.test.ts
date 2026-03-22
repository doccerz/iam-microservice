import { describe, it, expect } from "vitest";
import {
  AppError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "../errors.js";

describe("utils/errors.ts", () => {
  describe("AppError", () => {
    it("sets message, statusCode, and name", () => {
      const err = new AppError("something broke", 500);
      expect(err.message).toBe("something broke");
      expect(err.statusCode).toBe(500);
      expect(err.name).toBe("AppError");
    });

    it("is instanceof Error", () => {
      const err = new AppError("fail", 500);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("ConflictError", () => {
    it("has statusCode 409 and default message", () => {
      const err = new ConflictError();
      expect(err.statusCode).toBe(409);
      expect(err.message).toBe("Conflict");
      expect(err.name).toBe("ConflictError");
    });

    it("accepts custom message", () => {
      const err = new ConflictError("Email already exists");
      expect(err.message).toBe("Email already exists");
    });

    it("is instanceof AppError and Error", () => {
      const err = new ConflictError();
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("UnauthorizedError", () => {
    it("has statusCode 401 and default message", () => {
      const err = new UnauthorizedError();
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe("Unauthorized");
      expect(err.name).toBe("UnauthorizedError");
    });

    it("accepts custom message", () => {
      const err = new UnauthorizedError("Invalid token");
      expect(err.message).toBe("Invalid token");
    });

    it("is instanceof AppError and Error", () => {
      const err = new UnauthorizedError();
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("ForbiddenError", () => {
    it("has statusCode 403 and default message", () => {
      const err = new ForbiddenError();
      expect(err.statusCode).toBe(403);
      expect(err.message).toBe("Forbidden");
      expect(err.name).toBe("ForbiddenError");
    });

    it("accepts custom message", () => {
      const err = new ForbiddenError("Insufficient permissions");
      expect(err.message).toBe("Insufficient permissions");
    });

    it("is instanceof AppError and Error", () => {
      const err = new ForbiddenError();
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("NotFoundError", () => {
    it("has statusCode 404 and default message", () => {
      const err = new NotFoundError();
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Not Found");
      expect(err.name).toBe("NotFoundError");
    });

    it("accepts custom message", () => {
      const err = new NotFoundError("User not found");
      expect(err.message).toBe("User not found");
    });

    it("is instanceof AppError and Error", () => {
      const err = new NotFoundError();
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(Error);
    });
  });
});
