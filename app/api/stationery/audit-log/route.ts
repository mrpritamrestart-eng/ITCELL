import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import AuditLog from "@/models/AuditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 200, 1), 500);
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Audit log load nahi hua" }, { status: 500 });
  }
}
