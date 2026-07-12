import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";

const attempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 6;
const BLOCK_MS = 10 * 60 * 1000;

function getClientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: NextRequest) {
  try {
    const clientKey = getClientKey(request);
    const current = attempts.get(clientKey);
    if (current?.blockedUntil && current.blockedUntil > Date.now()) {
      return NextResponse.json(
        { success: false, message: "Too many failed attempts. Please try again after 10 minutes." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const expectedUsername = process.env.ADMIN_USERNAME;
    const expectedPassword = process.env.ADMIN_PASSWORD;

    if (!expectedUsername || !expectedPassword) {
      return NextResponse.json(
        { success: false, message: "Admin credentials are not configured on the server." },
        { status: 500 }
      );
    }

    if (username !== expectedUsername || password !== expectedPassword) {
      const count = (current?.count || 0) + 1;
      attempts.set(clientKey, {
        count,
        blockedUntil: count >= MAX_ATTEMPTS ? Date.now() + BLOCK_MS : 0,
      });
      return NextResponse.json(
        { success: false, message: "Invalid username or password" },
        { status: 401 }
      );
    }

    attempts.delete(clientKey);
    const response = NextResponse.json({ success: true, message: "Login successful" });
    response.cookies.set(AUTH_COOKIE_NAME, createSessionToken(username), sessionCookieOptions);
    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Login failed" },
      { status: 500 }
    );
  }
}
