import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import { nonNegativeNumber } from "@/lib/number-utils";
import { writeAuditLog } from "@/lib/audit";
import StationeryItem from "@/models/StationeryItem";
import StockTransaction from "@/models/StockTransaction";
import StockBalance from "@/models/StockBalance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
    const items = await StationeryItem.find(includeInactive ? {} : { isActive: true }).sort({ isActive: -1, sortOrder: 1, name: 1 }).lean();
    return NextResponse.json({ success: true, items });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Stationery items load nahi ho paye" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;
  try {
    await connectDB();
    const body = await request.json();
    const name = String(body.name || "").trim();
    const unit = String(body.unit || "").trim();
    const minimumRequired = nonNegativeNumber(body.minimumRequired || 0, "Minimum required stock");
    if (!name || !unit) throw new Error("Stationery item name aur unit required hain");

    const existing = await StationeryItem.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } });
    if (existing?.isActive) throw new Error("Ye stationery item already exist karta hai");
    if (existing) {
      existing.name = name;
      existing.unit = unit;
      existing.minimumRequired = minimumRequired;
      existing.isActive = true;
      await existing.save();
      await StockBalance.updateOne({ item: existing._id }, { $set: { itemName: name, unit } });
      await writeAuditLog({ action: "RESTORE", entityType: "StationeryItem", entityId: String(existing._id), performedBy: auth.session.username, summary: `${name} restored` });
      return NextResponse.json({ success: true, message: "Stationery item restore ho gaya", item: existing });
    }

    const lastItem = await StationeryItem.findOne({ isActive: true }).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const sortOrder = Number(lastItem?.sortOrder || 0) + 10;
    const item = await StationeryItem.create({ name, unit, minimumRequired, sortOrder, isActive: true });
    await writeAuditLog({ action: "CREATE", entityType: "StationeryItem", entityId: String(item._id), performedBy: auth.session.username, summary: `${name} (${unit}) created` });
    return NextResponse.json({ success: true, message: "Stationery item successfully add ho gaya", item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Stationery item save nahi ho paya" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;
  try {
    await connectDB();
    const body = await request.json();
    const id = String(body.id || "");
    if (!mongoose.isValidObjectId(id)) throw new Error("Valid stationery item ID required hai");
    const item = await StationeryItem.findById(id);
    if (!item) throw new Error("Stationery item not found");

    if (body.action === "delete") {
      item.isActive = false;
      await item.save();
      await writeAuditLog({ action: "DEACTIVATE", entityType: "StationeryItem", entityId: id, performedBy: auth.session.username, summary: `${item.name} deactivated` });
      return NextResponse.json({ success: true, message: "Item active list se remove ho gaya; old records safe hain" });
    }
    if (body.action === "restore") {
      item.isActive = true;
      await item.save();
      await writeAuditLog({ action: "RESTORE", entityType: "StationeryItem", entityId: id, performedBy: auth.session.username, summary: `${item.name} restored` });
      return NextResponse.json({ success: true, message: "Stationery item restore ho gaya", item });
    }

    const name = String(body.name || "").trim();
    const unit = String(body.unit || "").trim();
    const minimumRequired = nonNegativeNumber(body.minimumRequired || 0, "Minimum required stock");
    if (!name || !unit) throw new Error("Item name aur unit required hain");
    const duplicate = await StationeryItem.findOne({ _id: { $ne: id }, name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } }).lean();
    if (duplicate) throw new Error("Ye stationery item name already exist karta hai");

    if (unit.toLowerCase() !== item.unit.toLowerCase()) {
      const transactionExists = await StockTransaction.exists({ item: item._id, isVoided: { $ne: true } });
      if (transactionExists) throw new Error("Is item ki stock entries exist karti hain, isliye unit change nahi ki ja sakti. Naya item create karein.");
    }

    item.name = name;
    item.unit = unit;
    item.minimumRequired = minimumRequired;
    await item.save();
    await StockBalance.updateOne({ item: item._id }, { $set: { itemName: name, unit } });
    await writeAuditLog({ action: "UPDATE", entityType: "StationeryItem", entityId: id, performedBy: auth.session.username, summary: `${name} updated` });
    return NextResponse.json({ success: true, message: "Stationery item successfully update ho gaya", item });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Stationery item update nahi ho paya" }, { status: 400 });
  }
}
