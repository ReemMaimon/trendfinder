/** Domain error types used across services and API routes. */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ConfigError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "CONFIG_ERROR", 500, details);
    this.name = "ConfigError";
  }
}

/** Raised when PRODUCTION mode is active but affiliate config is incomplete. */
export class AffiliateConfigError extends ConfigError {
  constructor(public readonly missing: string[]) {
    super(
      `Affiliate configuration incomplete. Missing: ${missing.join(", ")}`,
      { missing },
    );
    this.name = "AffiliateConfigError";
  }
}

export class NotFoundError extends AppError {
  constructor(what = "Resource") {
    super(`${what} not found`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class AuthError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "AuthError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super("Too many requests", "RATE_LIMITED", 429);
    this.name = "RateLimitError";
  }
}

export class GenerationError extends AppError {
  constructor(message: string, public readonly step: string, details?: unknown) {
    super(message, "GENERATION_ERROR", 500, details);
    this.name = "GenerationError";
  }
}

export function toErrorResponse(err: unknown): {
  status: number;
  body: { error: { code: string; message: string; details?: unknown } };
} {
  if (err instanceof AppError) {
    return {
      status: err.httpStatus,
      body: {
        error: { code: err.code, message: err.message, details: err.details },
      },
    };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL", message: "Internal server error" } },
  };
}
