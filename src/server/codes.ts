import "server-only";
import { randomBytes } from "node:crypto";

// Crockford-style alphabet without ambiguous characters (0/O, 1/I/L).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomCode(length: number) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

/** Human-friendly booking reference, e.g. "BK-7K3F9QX". */
export const appointmentReference = () => `BK-${randomCode(7)}`;
export const quoteReference = () => `QT-${randomCode(7)}`;

export function receiptNumber() {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `R-${ymd}-${randomCode(5)}`;
}

/** Secret for guest self-service links. */
export const manageToken = () => randomBytes(24).toString("base64url");
