import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import Branch from "@/models/Branch";
import StationeryItem from "@/models/StationeryItem";
import OfficeSetting from "@/models/OfficeSetting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderRow = { id?: unknown; sortOrder?: unknown };

function columns(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), 3), 10);
}

function orderOperations(rows: unknown) {
  if (!Array.isArray(rows)) return [];
  return (rows as OrderRow[])
    .filter((row) => typeof row.id === "string" && row.id)
    .map((row, index) => ({
      updateOne: {
        filter: { _id: row.id },
        update: { $set: { sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index + 1 } },
      },
    }));
}

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;

  try {
    await connectDB();
    const [settings, branches, items] = await Promise.all([
      OfficeSetting.findOneAndUpdate(
        { scope: "GLOBAL" },
        { $setOnInsert: { scope: "GLOBAL" } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean(),
      Branch.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select("name code sortOrder").lean(),
      StationeryItem.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select("name unit sortOrder").lean(),
    ]);

    return NextResponse.json({
      success: true,
      settings: {
        branchTileColumns: settings?.branchTileColumns || 6,
        itemTileColumns: settings?.itemTileColumns || 6,
      },
      branches,
      items,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Popup settings load nahi hui" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;

  try {
    await connectDB();
    const body = await request.json();
    const branchTileColumns = columns(body.branchTileColumns, 6);
    const itemTileColumns = columns(body.itemTileColumns, 6);
    const branchOps = orderOperations(body.branchOrders);
    const itemOps = orderOperations(body.itemOrders);

    await Promise.all([
      OfficeSetting.findOneAndUpdate(
        { scope: "GLOBAL" },
        { $set: { branchTileColumns, itemTileColumns }, $setOnInsert: { scope: "GLOBAL" } },
        { new: true, upsert: true, runValidators: true }
      ),
      branchOps.length ? Branch.bulkWrite(branchOps) : Promise.resolve(),
      itemOps.length ? StationeryItem.bulkWrite(itemOps) : Promise.resolve(),
    ]);

    await writeAuditLog({
      action: "UPDATE",
      entityType: "OfficeSetting",
      performedBy: auth.session.username,
      summary: "Popup tile columns and master sort order updated",
      metadata: { branchTileColumns, itemTileColumns, branchCount: branchOps.length, itemCount: itemOps.length },
    });

    return NextResponse.json({ success: true, message: "Popup selection settings successfully save ho gayi" });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Popup settings save nahi hui" },
      { status: 400 }
    );
  }
}
