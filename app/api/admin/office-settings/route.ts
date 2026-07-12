import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import OfficeSetting from "@/models/OfficeSetting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const settings = await OfficeSetting.findOneAndUpdate(
      { scope: "GLOBAL" },
      { $setOnInsert: { scope: "GLOBAL" } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Office settings load nahi hui" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;
  try {
    await connectDB();
    const body = await request.json();
    const payload = {
      officeName: String(body.officeName || "").trim(),
      districtName: String(body.districtName || "").trim(),
      surveyTitle: String(body.surveyTitle || "").trim(),
      committeeParagraph: String(body.committeeParagraph || "").trim(),
      presidentLabel: String(body.presidentLabel || "").trim(),
      memberOneLabel: String(body.memberOneLabel || "").trim(),
      memberTwoLabel: String(body.memberTwoLabel || "").trim(),
      stockRegisterPage: String(body.stockRegisterPage || "").trim(),
    };
    if (!payload.officeName || !payload.surveyTitle || !payload.committeeParagraph) {
      return NextResponse.json({ success: false, message: "Office name, survey title aur committee paragraph required hain" }, { status: 400 });
    }
    const settings = await OfficeSetting.findOneAndUpdate({ scope: "GLOBAL" }, { $set: payload, $setOnInsert: { scope: "GLOBAL" } }, { new: true, upsert: true, runValidators: true });
    await writeAuditLog({ action: "UPDATE", entityType: "OfficeSetting", entityId: String(settings._id), performedBy: auth.session.username, summary: "Office/PDF settings updated" });
    return NextResponse.json({ success: true, message: "Office and PDF settings saved", settings });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Settings save nahi hui" }, { status: 500 });
  }
}
