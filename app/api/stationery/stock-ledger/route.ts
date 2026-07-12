import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import { parseDateOnly } from "@/lib/date-utils";
import StockTransaction from "@/models/StockTransaction";
import StationeryItem from "@/models/StationeryItem";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const itemId = request.nextUrl.searchParams.get("itemId") || "";
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    if (!mongoose.isValidObjectId(itemId)) throw new Error("Stock ledger ke liye item select karein");
    const item = await StationeryItem.findById(itemId).lean();
    if (!item) throw new Error("Item not found");

    const filter: Record<string, unknown> = { item: new mongoose.Types.ObjectId(itemId), isVoided: { $ne: true } };
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.$gte = parseDateOnly(from);
    if (to) {
      const end = parseDateOnly(to);
      end.setUTCDate(end.getUTCDate() + 1);
      dateFilter.$lt = end;
    }
    if (Object.keys(dateFilter).length) filter.transactionDate = dateFilter;

    let openingBalance = 0;
    if (from) {
      const before = await StockTransaction.aggregate<{ totalIn: number; totalOut: number }>([
        { $match: { item: new mongoose.Types.ObjectId(itemId), isVoided: { $ne: true }, transactionDate: { $lt: parseDateOnly(from) } } },
        { $group: { _id: null, totalIn: { $sum: "$quantityIn" }, totalOut: { $sum: "$quantityOut" } } },
      ]);
      openingBalance = (before[0]?.totalIn || 0) - (before[0]?.totalOut || 0);
    }

    const transactions = await StockTransaction.find(filter).sort({ transactionDate: 1, createdAt: 1 }).lean();
    let balance = openingBalance;
    const ledger = transactions.map((row) => {
      balance += (Number(row.quantityIn) || 0) - (Number(row.quantityOut) || 0);
      return { ...row, runningBalance: balance };
    });
    return NextResponse.json({ success: true, item: { _id: item._id, name: item.name, unit: item.unit }, openingBalance, closingBalance: balance, ledger });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Stock ledger load nahi ho paya" }, { status: 400 });
  }
}
