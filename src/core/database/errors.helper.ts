const UNIQUE_VIOLATION = "23505";

/**
 * Detects Postgres unique-constraint violations even when `instanceof` fails
 * (for example when the driver comes from a different module copy).
 */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as { code?: unknown; message?: unknown };

  if (candidate.code === UNIQUE_VIOLATION) return true;

  return (
    typeof candidate.message === "string" &&
    /duplicate key value violates unique constraint/i.test(candidate.message)
  );
}
