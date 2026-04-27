import { NextResponse } from "next/server";

type ErrorCode =
  | "OUT_OF_STOCK"
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "INVALID_TRANSITION"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "IDEMPOTENCY_CONFLICT"
  | "CREDIT_LIMIT_EXCEEDED"
  | "SERVER_ERROR";

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  field?: string
) {
  return NextResponse.json(
    { error: { code, message, ...(field ? { field } : {}) } },
    { status }
  );
}
