import type { StringValue } from "ms";

const UNIT_TO_MS = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 60 * 60_000,
  d: 24 * 60 * 60_000,
  w: 7 * 24 * 60 * 60_000,
} as const;

type ExpirationUnit = keyof typeof UNIT_TO_MS;

const EXPIRATION_PATTERN =
  /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)$/i;

/**
 * Converts a JWT expiration value such as:
 *
 * 15m
 * 30d
 * 2h
 * 7d
 * 1w
 *
 * into milliseconds.
 *
 * Only the units supported by this application are accepted.
 */
export const expirationToMilliseconds = (
  value: StringValue,
): number => {
  const normalized = value.trim();

  const match =
    normalized.match(EXPIRATION_PATTERN);

  if (!match) {
    throw new Error(
      `Unsupported token expiration format: "${value}". ` +
        `Use values such as "15m", "1h", "30d", or "1w".`,
    );
  }

  const amountText = match[1];
  const unitText = match[2];

  if (!amountText || !unitText) {
    throw new Error(
      `Invalid token expiration value: "${value}"`,
    );
  }

  const amount = Number(amountText);
  const unit =
    unitText.toLowerCase() as ExpirationUnit;

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      `Invalid token expiration value: "${value}"`,
    );
  }

  const unitMilliseconds =
    UNIT_TO_MS[unit];

  const milliseconds =
    amount * unitMilliseconds;

  if (
    !Number.isFinite(milliseconds) ||
    milliseconds <= 0
  ) {
    throw new Error(
      `Invalid token expiration value: "${value}"`,
    );
  }

  return milliseconds;
};