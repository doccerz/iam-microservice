import { describe, it, expect, vi, beforeEach } from "vitest";
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

vi.mock("swagger-ui-dist", () => ({
  absolutePath: () => "/fake/swagger-ui-path",
}));

import docsRouter from "../docs.routes.js";

type RouterLayer = {
  route?: {
    path: string;
    stack: { method: string; handle: (req: Request, res: Response, next: NextFunction) => void }[];
  };
  handle?: (req: Request, res: Response, next: NextFunction) => void;
};

function getHandler(method: "get", path: string) {
  const stack = (docsRouter as unknown as { stack: RouterLayer[] }).stack;
  const layer = stack.find(
    (l) => l.route?.path === path && l.route.stack.some((s) => s.method === method),
  );
  const handlers = layer?.route?.stack.filter((s) => s.method === method);
  return handlers?.[handlers.length - 1]?.handle;
}

function makeReqRes() {
  const req = {} as Request;
  const res = {
    type: vi.fn().mockReturnThis(),
    sendFile: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe("docs.routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /spec", () => {
    it("calls res.sendFile with a path ending in docs/openapi.yaml", () => {
      const { req, res, next } = makeReqRes();
      const handler = getHandler("get", "/spec");
      expect(handler).toBeDefined();

      handler!(req, res, next);

      expect(res.sendFile).toHaveBeenCalledOnce();
      const filePath: string = vi.mocked(res.sendFile).mock.calls[0][0] as string;
      expect(filePath.replace(/\\/g, "/")).toMatch(/docs\/openapi\.yaml$/);
    });

    it("sets content type to yaml", () => {
      const { req, res, next } = makeReqRes();
      const handler = getHandler("get", "/spec");

      handler!(req, res, next);

      expect(res.type).toHaveBeenCalledWith("yaml");
    });
  });

  describe("GET /", () => {
    it("redirects to /docs/index.html?url=/docs/spec", () => {
      const { req, res, next } = makeReqRes();
      const handler = getHandler("get", "/");
      expect(handler).toBeDefined();

      handler!(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith("/docs/index.html?url=/docs/spec");
    });
  });

  describe("static middleware", () => {
    it("has a static middleware layer for swagger-ui-dist assets", () => {
      const stack = (docsRouter as unknown as { stack: RouterLayer[] }).stack;
      const staticLayer = stack.find((l) => !l.route && typeof l.handle === "function");
      expect(staticLayer).toBeDefined();
    });
  });
});
