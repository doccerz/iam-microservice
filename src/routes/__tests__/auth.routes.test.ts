import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../../config/env.js", () => ({
  env: {
    JWT_ACCESS_SECRET: "test-access-secret",
    JWT_REFRESH_SECRET: "test-refresh-secret",
    JWT_ACCESS_EXPIRY: "15m",
    JWT_REFRESH_EXPIRY: "7d",
    DATABASE_URL: "postgres://localhost/test",
    DATABASE_SCHEMA: "iam",
    PORT: 3000,
    DEFAULT_ROLE_SLUG: "user",
  },
}));

vi.mock("../../services/auth.service.js", () => ({
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  changePassword: vi.fn(),
}));

vi.mock("../../db/index.js", () => ({ db: {} }));

import authRouter from "../auth.routes.js";
import { register, login, refresh, changePassword } from "../../services/auth.service.js";
import { ConflictError, UnauthorizedError } from "../../utils/errors.js";

const MOCK_USER = { id: "user-uuid", email: "test@example.com", createdAt: new Date() };
const MOCK_LOGIN_RESULT = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  user: { id: "user-uuid", email: "test@example.com" },
};
const MOCK_REFRESH_RESULT = {
  accessToken: "new-access-token",
  refreshToken: "new-refresh-token",
};

function makeReqRes(body: unknown) {
  const req = { body } as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

type RouteLayer = {
  route: {
    path: string;
    stack: { method: string; handle: (req: Request, res: Response, next: NextFunction) => void }[];
  };
};

// Extract the last route handler (skipping middleware like validate)
function getHandler(method: "post", path: string) {
  const layer = (authRouter as unknown as RouteLayer[]).stack.find(
    (l) => l.route?.path === path,
  );
  const handlers = layer?.route.stack.filter((s) => s.method === method);
  return handlers?.[handlers.length - 1]?.handle;
}

describe("auth.routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("POST /register", () => {
    it("calls register with req.body and responds 201 on success", async () => {
      vi.mocked(register).mockResolvedValueOnce(MOCK_USER);
      const { req, res, next } = makeReqRes({ email: "test@example.com", password: "password123" });

      const handler = getHandler("post", "/register");
      await handler!(req, res, next);

      expect(register).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: MOCK_USER });
    });

    it("passes ConflictError to next on duplicate email", async () => {
      const err = new ConflictError("Email already in use");
      vi.mocked(register).mockRejectedValueOnce(err);
      const { req, res, next } = makeReqRes({ email: "dupe@example.com", password: "password123" });

      const handler = getHandler("post", "/register");
      await handler!(req, res, next);
      await Promise.resolve(); // flush .catch(next) microtask

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("POST /login", () => {
    it("calls login with req.body and responds 200 on success", async () => {
      vi.mocked(login).mockResolvedValueOnce(MOCK_LOGIN_RESULT);
      const { req, res, next } = makeReqRes({ email: "test@example.com", password: "password123" });

      const handler = getHandler("post", "/login");
      await handler!(req, res, next);

      expect(login).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: MOCK_LOGIN_RESULT });
    });

    it("passes UnauthorizedError to next on bad credentials", async () => {
      const err = new UnauthorizedError("Invalid credentials");
      vi.mocked(login).mockRejectedValueOnce(err);
      const { req, res, next } = makeReqRes({ email: "test@example.com", password: "wrong" });

      const handler = getHandler("post", "/login");
      await handler!(req, res, next);
      await Promise.resolve(); // flush .catch(next) microtask

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("POST /refresh", () => {
    it("calls refresh with req.body.token and responds 200 on success", async () => {
      vi.mocked(refresh).mockResolvedValueOnce(MOCK_REFRESH_RESULT);
      const { req, res, next } = makeReqRes({ token: "old-refresh-token" });

      const handler = getHandler("post", "/refresh");
      await handler!(req, res, next);

      expect(refresh).toHaveBeenCalledWith("old-refresh-token");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: MOCK_REFRESH_RESULT });
    });

    it("passes UnauthorizedError to next on invalid token", async () => {
      const err = new UnauthorizedError("Invalid or expired refresh token");
      vi.mocked(refresh).mockRejectedValueOnce(err);
      const { req, res, next } = makeReqRes({ token: "bad-token" });

      const handler = getHandler("post", "/refresh");
      await handler!(req, res, next);
      await Promise.resolve(); // flush .catch(next) microtask

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("POST /change-password", () => {
    it("calls changePassword with userId from req.user and responds 200 on success", async () => {
      vi.mocked(changePassword).mockResolvedValueOnce(undefined);
      const { req, res, next } = makeReqRes({
        oldPassword: "password123",
        newPassword: "newpassword123",
      });
      (req as Request & { user: unknown }).user = {
        sub: "user-uuid",
        email: "test@example.com",
        permissions: [],
      };

      const handler = getHandler("post", "/change-password");
      await handler!(req, res, next);

      expect(changePassword).toHaveBeenCalledWith("user-uuid", req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it("passes error to next when changePassword throws", async () => {
      const err = new UnauthorizedError("Invalid credentials");
      vi.mocked(changePassword).mockRejectedValueOnce(err);
      const { req, res, next } = makeReqRes({
        oldPassword: "wrong",
        newPassword: "newpassword123",
      });
      (req as Request & { user: unknown }).user = {
        sub: "user-uuid",
        email: "test@example.com",
        permissions: [],
      };

      const handler = getHandler("post", "/change-password");
      await handler!(req, res, next);
      await Promise.resolve(); // flush .catch(next) microtask

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
