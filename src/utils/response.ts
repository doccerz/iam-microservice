import type { Response } from "express";
import type { ApiResponse } from "../types/index.js";

export function sendSuccess<T>(
  res: Response,
  data?: T,
  statusCode = 200,
): void {
  const body: ApiResponse<T> = { success: true };
  if (data !== undefined) body.data = data;
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
): void {
  const body: ApiResponse<never> = { success: false, error: message };
  res.status(statusCode).json(body);
}
