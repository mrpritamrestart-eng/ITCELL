import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import { parseDateOnly, todayInIndia } from "@/lib/date-utils";
import { nonNegativeNumber } from "@/lib/number-utils";
import { changeStockBalance, ensureStockBalances } from "@/lib/stock";
import { writeAuditLog } from "@/lib/audit";
import StationeryItem from "@/models/StationeryItem";
import StockTransaction from "@/models/StockTransaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OpeningStockRequestItem = { itemId: string; quantity: number };
type LeanItem = { _id: mongoose.Types.ObjectId; name: string; unit: string; minimumRequired?: number };

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const items = (await StationeryItem.find({ isActive: true }).sort({ name: 1 }).lean()) as LeanItem[];
    const openingTransactions = await StockTransaction.find({
      item: { $in: items.map((item) => item._id) },
      transactionType: "OPENING_STOCK",
      isVoided: { $ne: true },
    }).lean();
    const map = new Map(openingTransactions.map((row) => [String(row.item), Number(row.quantityIn) || 0]));
    const operationalCount = await StockTransaction.countDocuments({
      transactionType: { $in: ["PURCHASE_IN", "BRANCH_OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"] },
      isVoided: { $ne: true },
    });
    return NextResponse.json({
      success: true,
      locked: operationalCount > 0 && process.env.ALLOW_OPENING_STOCK_EDIT !== "true",
      lockReason: operationalCount > 0 ? "Purchase/Out/Adjustment records exist. Corrections ke liye Stock Adjustment use karein." : "",
      items: items.map((item) => ({
        itemId: String(item._id),
        itemName: item.name,
        unit: item.unit,
        minimumRequired: item.minimumRequired || 0,
        quantity: map.get(String(item._id)) || 0,
      })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Opening stock load nahi ho paya" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;
  let session: mongoose.ClientSession | null = null;
  try {
    await connectDB();
    const body = await request.json();
    const stockDateText = String(body.stockDate || "");
    const remarks = String(body.remarks || "").trim();
    const items = body.items as OpeningStockRequestItem[];
    if (!stockDateText) throw new Error("Opening stock date required hai");
    if (stockDateText > todayInIndia()) throw new Error("Future date allowed nahi hai");
    if (!Array.isArray(items) || !items.length) throw new Error("Kam se kam ek item required hai");

    const operationalCount = await StockTransaction.countDocuments({
      transactionType: { $in: ["PURCHASE_IN", "BRANCH_OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"] },
      isVoided: { $ne: true },
    });
    if (operationalCount > 0 && process.env.ALLOW_OPENING_STOCK_EDIT !== "true") {
      throw new Error("Opening Stock locked hai. Difference correct karne ke liye Stock Adjustment module use karein.");
    }

    const ids = items.map((row) => {
      if (!mongoose.isValidObjectId(row.itemId)) throw new Error("Invalid stationery item");
      nonNegativeNumber(row.quantity, "Quantity");
      return new mongoose.Types.ObjectId(row.itemId);
    });
    const dbItems = (await StationeryItem.find({ _id: { $in: ids }, isActive: true }).lean()) as LeanItem[];
    if (dbItems.length !== ids.length) throw new Error("One or more stationery items invalid hain");
    const itemMap = new Map(dbItems.map((item) => [String(item._id), item]));
    await ensureStockBalances(ids);

    const existing = await StockTransaction.find({ item: { $in: ids }, transactionType: "OPENING_STOCK", isVoided: { $ne: true } }).lean();
    const existingMap = new Map(existing.map((row) => [String(row.item), Number(row.quantityIn) || 0]));
    const stockDate = parseDateOnly(stockDateText);

    session = await mongoose.startSession();
    session.startTransaction();
    for (const row of items) {
      const dbItem = itemMap.get(row.itemId);
      if (!dbItem) throw new Error("Invalid stationery item");
      const nextQuantity = nonNegativeNumber(row.quantity, "Quantity");
      const previousQuantity = existingMap.get(row.itemId) || 0;
      const delta = nextQuantity - previousQuantity;
      if (delta !== 0) {
        const updated = await changeStockBalance({ itemId: dbItem._id, itemName: dbItem.name, unit: dbItem.unit, delta, session });
        if (!updated) throw new Error(`${dbItem.name} ka opening stock itna reduce nahi kiya ja sakta`);
      }
      await StockTransaction.findOneAndUpdate(
        { item: dbItem._id, transactionType: "OPENING_STOCK", isVoided: { $ne: true } },
        {
          $set: {
            item: dbItem._id,
            itemName: dbItem.name,
            unit: dbItem.unit,
            transactionType: "OPENING_STOCK",
            quantityIn: nextQuantity,
            quantityOut: 0,
            transactionDate: stockDate,
            referenceModel: "OpeningStock",
            remarks,
            createdBy: auth.session.username,
          },
        },
        { upsert: true, new: true, session }
      );
    }
    await session.commitTransaction();
    await writeAuditLog({ action: "UPDATE", entityType: "OpeningStock", performedBy: auth.session.username, summary: `Opening stock updated for ${items.length} items`, metadata: { stockDate: stockDateText, remarks } });
    return NextResponse.json({ success: true, message: "Opening stock successfully save ho gaya" });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Opening stock save nahi ho paya" }, { status: 400 });
  } finally {
    await session?.endSession();
  }
}
