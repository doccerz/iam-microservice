import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "../logger.js";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logger.info delegates to console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("hello", "world");
    expect(spy).toHaveBeenCalledWith("hello", "world");
  });

  it("logger.error delegates to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("oops");
    logger.error(err);
    expect(spy).toHaveBeenCalledWith(err);
  });
});
