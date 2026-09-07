import { NextResponse } from "next/server";
import { requireSession } from "./session";
import { toErrorResponse, AuthError } from "./errors";
import { logger } from "./logger";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(err: unknown) {
  if (!(err instanceof Error) || err.name === "AppError" || "code" in (err as object)) {
    // handled domain errors
  } else {
    logger.error({ err }, "unhandled API error");
  }
  const { status, body } = toErrorResponse(err);
  return NextResponse.json(body, { status });
}

/** Wrap an admin route handler with session enforcement + error handling. */
export function adminRoute<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>,
) {
  return async (...args: T): Promise<Response> => {
    try {
      await requireSession();
      return await handler(...args);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Admin login required" } },
          { status: 401 },
        );
      }
      return errorResponse(err);
    }
  };
}

export function publicRoute<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>,
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
