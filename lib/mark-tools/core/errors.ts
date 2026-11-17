export type ErrorCode =
  | "INVALID_ARGUMENT"
  | "PATH_NOT_ALLOWED"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "NOT_A_FILE"
  | "TOO_LARGE"
  | "BINARY_FILE"
  | "STALE_FILE"
  | "NO_MATCH"
  | "MULTIPLE_MATCHES"
  | "PATCH_FAILED"
  | "READ_ONLY"
  | "NO_BACKUP";

/**
 * An expected, user-correctable failure. The tool layer turns these into a
 * structured `{ ok: false, error }` payload so the agent can self-correct
 * instead of seeing an opaque HTTP 500.
 */
export class FileToolError extends Error {
  code: ErrorCode;
  hint?: string;
  details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { hint?: string; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "FileToolError";
    this.code = code;
    this.hint = opts.hint;
    this.details = opts.details;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.hint ? { hint: this.hint } : {}),
      ...(this.details ? { details: this.details } : {}),
    };
  }
}
