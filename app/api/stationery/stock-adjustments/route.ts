import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import { parseDateOnly, todayInIndia } from "@/lib/date-utils";
import { positiveNumber } from "@/lib/number-utils";
import { nextDocumentNumber } from "@/lib/sequence";
import { changeStockBalance, ensureStockBalances } from "@/lib/stock";
import { writeAuditLog } from "@/lib/audit";
import StationeryItem from "@/models/StationeryItem";
import StockAdjustment from "@/models/StockAdjustment";
import StockTransaction from "@/models/StockTransaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const status = request.nextUrl.searchParams.get("status") || "ALL";
    const filter = status === "ALL" ? {} : { status };
    const entries = await StockAdjustment.find(filter).sort({ adjustmentDate: -1, createdAt: -1 }).limit(200).lean();
    return NextResponse.json({ success: true, entries });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Adjustments load nahi ho paye" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;
  let session: mongoose.ClientSession | null = null;
  try {
    await connectDB();
    const body = await request.json();
    const itemId = String(body.itemId || "");
    const adjustmentDateText = String(body.adjustmentDate || "");
    const adjustmentType = String(body.adjustmentType || "");
    const quantity = positiveNumber(body.quantity, "Quantity");
    const reason = String(body.reason || "").trim();

    if (!mongoose.isValidObjectId(itemId)) throw new Error("Valid stationery item select karein");
    if (!adjustmentDateText) throw new Error("Adjustment date required hai");
    if (adjustmentDateText > todayInIndia()) throw new Error("Future date allowed nahi hai");
    if (!["INCREASE", "DECREASE"].includes(adjustmentType)) throw new Error("Invalid adjustment type");
    if (reason.length < 5) throw new Error("Adjustment reason kam se kam 5 characters ka hona chahiye");

    const item = await StationeryItem.findById(itemId).lean();
    if (!item) throw new Error("Stationery item not found");
    const objectId = new mongoose.Types.ObjectId(itemId);
    await ensureStockBalances([objectId]);

    session = await mongoose.startSession();
    session.startTransaction();
    const delta = adjustmentType === "INCREASE" ? quantity : -quantity;
    const updated = await changeStockBalance({ itemId: objectId, itemName: item.name, unit: item.unit, delta, session });
    if (!updated) throw new Error(`${item.name} ka stock ${quantity} ${item.unit} reduce karne ke liye sufficient nahi hai`);

    const adjustmentDate = parseDateOnly(adjustmentDateText);
    const adjustmentNo = await nextDocumentNumber("ADJ", adjustmentDate, session);
    const [entry] = await StockAdjustment.create([{
      adjustmentNo,
      adjustmentDate,
      item: objectId,
      itemName: item.name,
      unit: item.unit,
      adjustmentType,
      quantity,
      reason,
      status: "ACTIVE",
      createdBy: auth.session.username,
    }], { session });

    await StockTransaction.create([{
      item: objectId,
      itemName: item.name,
      unit: item.unit,
      transactionType: adjustmentType === "INCREASE" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
      quantityIn: adjustmentType === "INCREASE" ? quantity : 0,
      quantityOut: adjustmentType === "DECREASE" ? quantity : 0,
      transactionDate: adjustmentDate,
      referenceModel: "StockAdjustment",
      referenceId: entry._id,
      remarks: reason,
      createdBy: auth.session.username,
    }], { session });

    await session.commitTransaction();
    await writeAuditLog({ action: "CREATE", entityType: "StockAdjustment", entityId: String(entry._id), performedBy: auth.session.username, summary: `${adjustmentNo} - ${item.name} ${adjustmentType} ${quantity}`, metadata: { reason } });
    return NextResponse.json({ success: true, message: `Stock adjustment ${adjustmentNo} saved successfully`, entry }, { status: 201 });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Adjustment save nahi ho paya" }, { status: 400 });
  } finally {
    await session?.endSession();
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;
  let session: mongoose.ClientSession | null = null;
  try {
    await connectDB();
    const body = await request.json();
    const id = String(body.id || "");
    const voidReason = String(body.reason || "").trim();
    if (body.action !== "void") throw new Error("Unsupported action");
    if (!mongoose.isValidObjectId(id)) throw new Error("Invalid adjustment");
    if (voidReason.length < 5) throw new Error("Cancellation reason kam se kam 5 characters ka hona chahiye");

    const entry = await StockAdjustment.findById(id).lean();
    if (!entry) throw new Error("Adjustment not found");
    if (entry.status === "VOID") throw new Error("Adjustment already cancelled hai");
    const itemId = new mongoose.Types.ObjectId(String(entry.item));
    await ensureStockBalances([itemId]);

    session = await mongoose.startSession();
    session.startTransaction();
    const reverseDelta = entry.adjustmentType === "INCREASE" ? -Number(entry.quantity) : Number(entry.quantity);
    const updated = await changeStockBalance({ itemId, itemName: entry.itemName, unit: entry.unit, delta: reverseDelta, session });
    if (!updated) throw new Error("Adjustment reversal ke liye current stock sufficient nahi hai");

    await StockAdjustment.updateOne({ _id: id, status: { $ne: "VOID" } }, {
      $set: { status: "VOID", voidedAt: new Date(), voidedBy: auth.session.username, voidReason },
    }, { session });
    await StockTransaction.updateMany({ referenceModel: "StockAdjustment", referenceId: entry._id }, {
      $set: { isVoided: true, voidedAt: new Date() },
    }, { session });
    await session.commitTransaction();

    await writeAuditLog({ action: "VOID", entityType: "StockAdjustment", entityId: id, performedBy: auth.session.username, summary: `${entry.adjustmentNo} cancelled`, metadata: { voidReason } });
    return NextResponse.json({ success: true, message: "Adjustment cancelled and stock reversed successfully" });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Adjustment cancel nahi ho paya" }, { status: 400 });
  } finally {
    await session?.endSession();
  }
}
