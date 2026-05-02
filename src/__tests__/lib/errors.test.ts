jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}));

import { errorResponse } from "@/lib/errors";

describe("errorResponse", () => {
  it("returns the correct HTTP status code", () => {
    const res = errorResponse("UNAUTHORIZED", "Not authenticated", 401) as any;
    expect(res.status).toBe(401);
  });

  it("embeds the error code in the body", () => {
    const res = errorResponse("NOT_FOUND", "Resource not found", 404) as any;
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("embeds the error message in the body", () => {
    const res = errorResponse("NOT_FOUND", "Resource not found", 404) as any;
    expect(res.body.error.message).toBe("Resource not found");
  });

  it("includes field when provided", () => {
    const res = errorResponse("INVALID_INPUT", "Bad value", 400, "email") as any;
    expect(res.body.error.field).toBe("email");
  });

  it("omits field when not provided", () => {
    const res = errorResponse("UNAUTHORIZED", "Not authenticated", 401) as any;
    expect(res.body.error.field).toBeUndefined();
  });

  it("wraps the error in an 'error' key", () => {
    const res = errorResponse("SERVER_ERROR", "Crash", 500) as any;
    expect(res.body).toHaveProperty("error");
    expect(Object.keys(res.body)).toEqual(["error"]);
  });

  const cases: [string, number][] = [
    ["OUT_OF_STOCK", 422],
    ["UNAUTHORIZED", 401],
    ["INVALID_INPUT", 400],
    ["INVALID_TRANSITION", 400],
    ["NOT_FOUND", 404],
    ["RATE_LIMITED", 429],
    ["IDEMPOTENCY_CONFLICT", 409],
    ["CREDIT_LIMIT_EXCEEDED", 422],
    ["SERVER_ERROR", 500],
  ];

  cases.forEach(([code, status]) => {
    it(`maps ${code} → ${status}`, () => {
      const res = errorResponse(code as any, "msg", status) as any;
      expect(res.body.error.code).toBe(code);
      expect(res.status).toBe(status);
    });
  });
});
