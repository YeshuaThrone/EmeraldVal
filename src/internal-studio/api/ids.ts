const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function requiredTrimmed(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

export function optionalTrimmed(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function requiredUuid(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = requiredTrimmed(record, key);
  if (!isUuid(value)) {
    throw new Error(`${key} must be a UUID`);
  }
  return value;
}

export function optionalUuid(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = optionalTrimmed(record, key);
  if (value == null) return null;
  if (!isUuid(value)) {
    throw new Error(`${key} must be a UUID`);
  }
  return value;
}

export function requiredInt(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${key} must be an integer`);
  }
  return value;
}

export function asRecord(body: unknown, label: string): Record<string, unknown> {
  if (!body || typeof body !== "object") {
    throw new Error(`${label} is invalid`);
  }
  return body as Record<string, unknown>;
}
