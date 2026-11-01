import { DatabaseError } from "pg";

const UNIQUE_VIOLATION = "23505";

/**
 * Detects Postgres unique-constraint violations even when `instanceof` fails
 * (for example when the driver comes from a different module copy).
 */
export function isUniqueViolation(error: unknown): boolean {
  if (error instanceof DatabaseError) {
    return error.code === UNIQUE_VIOLATION;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}
