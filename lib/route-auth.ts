import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export async function requireRouteAuth() {
  const session = await getAuthenticatedUser();
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
