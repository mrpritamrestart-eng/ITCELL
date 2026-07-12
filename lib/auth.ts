import crypto from "node:crypto";
import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "office_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 10;

type SessionPayload = {
  username: string;
  exp: number;
};

function getSecret() {
  const secret = process.env.ADMIN_AUTH_TOKEN;
  if (!secret || secret.length < 16) {
    throw new Error("ADMIN_AUTH_TOKEN must be configured with at least 16 characters");
  }
  return secret;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createSessionToken(username: string) {
  const payload: SessionPayload = {
    username,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  try {
    const expected = sign(encoded);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(decode(encoded)) as SessionPayload;
    if (!payload.username || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export async function isAuthenticated() {
  return Boolean(await getAuthenticatedUser());
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
