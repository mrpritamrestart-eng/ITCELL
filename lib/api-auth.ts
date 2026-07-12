import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export function requireApiAuth(request: NextRequest | Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(AUTH_COOKIE_NAME.length + 1);

  const session = verifySessionToken(token ? decodeURIComponent(token) : null);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { success: false, message: "Session expired. Please login again." },
        { status: 401 }
      ),
    };
  }
  return { session, response: null };
}
