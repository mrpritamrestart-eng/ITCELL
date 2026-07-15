import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import Branch from "@/models/Branch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function generateBranchCode() {
  const rows = await Branch.find({ code: /^BR\d+$/i }).select("code").lean();
  const max = rows.reduce((value, row) => Math.max(value, Number(String(row.code).replace(/\D/g, "")) || 0), 0);
  return `BR${String(max + 1).padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
    const branches = await Branch.find(includeInactive ? {} : { isActive: true }).sort({ isActive: -1, sortOrder: 1, name: 1 }).lean();
    return NextResponse.json({ success: true, branches });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Branches load nahi ho payi" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;
  try {
    await connectDB();
    const body = await request.json();
    const name = String(body.name || "").trim();
    const code = String(body.code || "").trim().toUpperCase() || await generateBranchCode();
    if (!name) throw new Error("PS/Branch name required hai");
    if (!code) throw new Error("Branch code required hai");

    const sameName = await Branch.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } });
    const sameCode = await Branch.findOne({ code: { $regex: `^${escapeRegex(code)}$`, $options: "i" } });
    if (sameName && sameCode && String(sameName._id) === String(sameCode._id) && !sameName.isActive) {
      sameName.name = name;
      sameName.code = code;
      sameName.isActive = true;
      await sameName.save();
      await writeAuditLog({ action: "RESTORE", entityType: "Branch", entityId: String(sameName._id), performedBy: auth.session.username, summary: `${name} (${code}) restored` });
      return NextResponse.json({ success: true, message: "PS/Branch successfully restore ho gayi", branch: sameName });
    }
    if (sameName) throw new Error("Ye PS/Branch name already exist karta hai");
    if (sameCode) throw new Error("Ye Branch Code already exist karta hai");

    const lastBranch = await Branch.findOne({ isActive: true }).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const sortOrder = Number(lastBranch?.sortOrder || 0) + 10;
    const branch = await Branch.create({ name, code, sortOrder, isActive: true });
    await writeAuditLog({ action: "CREATE", entityType: "Branch", entityId: String(branch._id), performedBy: auth.session.username, summary: `${name} (${code}) created` });
    return NextResponse.json({ success: true, message: "PS/Branch successfully add ho gayi", branch }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Branch save nahi ho payi" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;
  try {
    await connectDB();
    const body = await request.json();
    const id = String(body.id || "");
    if (!mongoose.isValidObjectId(id)) throw new Error("Valid Branch ID required hai");
    const branch = await Branch.findById(id);
    if (!branch) throw new Error("Branch not found");

    if (body.action === "delete") {
      branch.isActive = false;
      await branch.save();
      await writeAuditLog({ action: "DEACTIVATE", entityType: "Branch", entityId: id, performedBy: auth.session.username, summary: `${branch.name} deactivated` });
      return NextResponse.json({ success: true, message: "PS/Branch active list se remove ho gayi; old records safe hain" });
    }
    if (body.action === "restore") {
      branch.isActive = true;
      await branch.save();
      await writeAuditLog({ action: "RESTORE", entityType: "Branch", entityId: id, performedBy: auth.session.username, summary: `${branch.name} restored` });
      return NextResponse.json({ success: true, message: "PS/Branch restore ho gayi", branch });
    }

    const name = String(body.name || "").trim();
    const code = String(body.code || "").trim().toUpperCase();
    if (!name || !code) throw new Error("Branch name aur code required hain");
    const duplicate = await Branch.findOne({
      _id: { $ne: id },
      $or: [
        { name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } },
        { code: { $regex: `^${escapeRegex(code)}$`, $options: "i" } },
      ],
    }).lean();
    if (duplicate) throw new Error("Same branch name ya code already exist karta hai");
    branch.name = name;
    branch.code = code;
    await branch.save();
    await writeAuditLog({ action: "UPDATE", entityType: "Branch", entityId: id, performedBy: auth.session.username, summary: `${name} (${code}) updated` });
    return NextResponse.json({ success: true, message: "PS/Branch successfully update ho gayi", branch });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Branch update nahi ho payi" }, { status: 400 });
  }
}
