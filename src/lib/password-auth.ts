import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const PASSWORD_SESSION_COOKIE = "lithium_access";
export const PASSWORD_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function passwordMatches(submitted: string, configured: string | undefined): boolean {
  if (!configured || !submitted) return false;
  const submittedDigest = createHash("sha256").update(submitted).digest();
  const configuredDigest = createHash("sha256").update(configured).digest();
  return timingSafeEqual(submittedDigest, configuredDigest);
}

export function createPasswordSessionToken(
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): string {
  if (!secret) throw new Error("A senha de acesso não está configurada.");

  const expiresAt = nowSeconds + PASSWORD_SESSION_TTL_SECONDS;
  const payload = `v1.${expiresAt}.${randomBytes(16).toString("base64url")}`;
  return `${payload}.${signature(payload, secret)}`;
}

export function isPasswordSessionTokenValid(
  token: string | undefined,
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1_000),
): boolean {
  if (!token || !secret) return false;

  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;

  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds) return false;

  const payload = parts.slice(0, 3).join(".");
  return constantTimeEqual(parts[3], signature(payload, secret));
}

export function safeReturnPath(value: FormDataEntryValue | string | string[] | null | undefined): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  return value;
}
