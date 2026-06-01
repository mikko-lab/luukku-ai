const MIN_SECRET_LENGTH = 32;

export function getJwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new Error("JWT_SECRET is required");
  }
  if (s.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${s.length})`,
    );
  }
  return new TextEncoder().encode(s);
}
