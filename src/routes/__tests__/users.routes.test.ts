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

vi.mock("../../services/users.service.js", () => ({
  createUser: vi.fn(),
  listUsers: vi.fn(),
  updateUser: vi.fn(),
  updateUserRoles: vi.fn(),
}));

vi.mock("../../db/index.js", () => ({ db: {} }));

import usersRouter from "../users.routes.js";
import { createUser, listUsers, updateUser, updateUserRoles } from "../../services/users.service.js";
import { ConflictError, NotFoundError } from "../../utils/errors.js";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";
const roleUuid = "660e8400-e29b-41d4-a716-446655440000";

const MOCK_USER = { id: validUuid, email: "user@example.com", createdAt: new Date() };
const MOCK_LIST_RESULT = {
  users: [MOCK_USER],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};
const MOCK_UPDATED_USER = {
  id: validUuid,
  email: "user@example.com",
  isActive: false,
  updatedAt: new Date(),
};

function makeReqRes(options: {
  body?: unknown;
  query?: Record<string, string>;
  params?: Record<string, string>;
}) {
  const req = {
    body: options.body ?? {},
    query: options.query ?? {},
    params: options.params ?? {},
  } as unknown as Request;
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

function getHandler(method: "post" | "get" | "patch" | "put", path: string) {
  const layer = (usersRouter as unknown as { stack: RouteLayer[] }).stack.find(
    (l) => l.route?.path === path,
  );
  const handlers = layer?.route.stack.filter((s) => s.method === method);
  return handlers?.[handlers.length - 1]?.handle;
}

describe("users.routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("POST /", () => {
    it("calls createUser with req.body and responds 201 on success", async () => {
      vi.mocked(createUser).mockResolvedValueOnce(MOCK_USER);
      const { req, res, next } = makeReqRes({
        body: { email: "user@example.com", password: "password123", roleIds: [roleUuid] },
      });

      const handler = getHandler("post", "/");
      await handler!(req, res, next);

      expect(createUser).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: MOCK_USER });
    });

    it("passes ConflictError to next on duplicate email", async () => {
      const err = new ConflictError("Email already in use");
      vi.mocked(createUser).mockRejectedValueOnce(err);
      const { req, res, next } = makeReqRes({
        body: { email: "existing@example.com", password: "password123", roleIds: [roleUuid] },
      });

      const handler = getHandler("post", "/");
      await handler!(req, res, next);
      await Promise.resolve();

      expect(next).toHaveBeenCalledWith(err);
    });

    it("passes error to next when createUser throws", async () => {
      const err = new Error("unexpected");
      vi.mocked(createUser).mockRejectedValueOnce(err);
      const { req, res, next } = makeReqRes({ body: {} });

      const handler = getHandler("post", "/");
      await handler!(req, res, next);
      await Promise.resolve();

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("GET /", () => {
    it("calls listUsers with req.query and responds 200 on success", async () => {
      vi.mocked(listUsers).mockResolvedValueOnce(MOCK_LIST_RESULT);
      const { req, res, next } = makeReqRes({ query: { page: "1", limit: "20" } });

      const handler = getHandler("get", "/");
      await handler!(req, res, next);

      expect(listUsers).toHaveBeenCalledWith(req.query);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: MOCK_LIST_RESULT });
    });

    it("passes error to next when listUsers throws", async () => {
      const err = new Error("unexpected");
      vi.mocked(listUsers).mockRejectedValueOnce(err);
      const { req, res, next } = makeReqRes({});

      const handler = getHandler("get", "/");
      await handler!(req, res, next);
      await Promise.resolve();

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("PATCH /:id", () => {
    it("calls updateUser with req.params.id and req.body, responds 200 on success", async () => {
      vi.mocked(updateUser).mockResolvedValueOnce(MOCK_UPDATED_USER);
      const { req, res, next } = makeReqRes({
        body: { isActive: false },
        params: { id: validUuid },
      });

      const handler = getHandler("patch", "/:id");
      await handler!(req, res, next);

      expect(updateUser).toHaveBeenCalledWith(validUuid, req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: MOCK_UPDATED_USER });
    });

    it("passes NotFoundError to next when user not found", async () => {
      const err = new NotFoundError("User not found");
      vi.mocked(updateUser).mockRejectedValueOnce(err);
      const { req, res, next } = makeReqRes({
        body: { isActive: false },
        params: { id: validUuid },
      });

      const handler = getHandler("patch", "/:id");
      await handler!(req, res, next);
      await Promise.resolve();

      expect(next).toHaveBeenCalledWith(err);
    });

    it("passes error to next when updateUser throws", async () => {
      const err = new Error("unexpected");
      vi.mocked(updateUser).mockRejectedValueOnce(err);
      const { req, res, next } = makeReqRes({ body: {}, params: { id: validUuid } });

      const handler = getHandler("patch", "/:id");
      await handler!(req, res, next);
      await Promise.resolve();

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("PUT /:id/roles", () => {
    it("calls updateUserRoles with req.params.id and req.body, responds 200 on success", async () => {
      vi.mocked(updateUserRoles).mockResolvedValueOnce(undefined);
      const { req, res, next } = makeReqRes({
        body: { roleIds: [roleUuid] },
        params: { id: validUuid },
      });

      const handler = getHandler("put", "/:id/roles");
      await handler!(req, res, next);

      expect(updateUserRoles).toHaveBeenCalledWith(validUuid, req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it("passes NotFoundError to next when user not found", async () => {
      const err = new NotFoundError("User not found");
      vi.mocked(updateUserRoles).mockRejectedValueOnce(err);
      const { req, res, next } = makeReqRes({
        body: { roleIds: [roleUuid] },
        params: { id: validUuid },
      });

      const handler = getHandler("put", "/:id/roles");
      await handler!(req, res, next);
      await Promise.resolve();

      expect(next).toHaveBeenCalledWith(err);
    });

    it("passes error to next when updateUserRoles throws", async () => {
      const err = new Error("unexpected");
      vi.mocked(updateUserRoles).mockRejectedValueOnce(err);
      const { req, res, next } = makeReqRes({ body: {}, params: { id: validUuid } });

      const handler = getHandler("put", "/:id/roles");
      await handler!(req, res, next);
      await Promise.resolve();

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
