import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import { ensureStockBalances } from "@/lib/stock";
import StationeryItem from "@/models/StationeryItem";
import StockBalance from "@/models/StockBalance";
import StockTransaction from "@/models/StockTransaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeanItem = { _id: mongoose.Types.ObjectId; name: string; unit: string; minimumRequired?: number };

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const showInactive = request.nextUrl.searchParams.get("showInactive") === "true";
    const items = (await StationeryItem.find(showInactive ? {} : { isActive: true }).sort({ name: 1 }).lean()) as LeanItem[];
    await ensureStockBalances(items.map((item) => item._id));
    const itemIds = items.map((item) => item._id);
    const [balances, movementRows] = await Promise.all([
      StockBalance.find({ item: { $in: itemIds } }).lean(),
      StockTransaction.aggregate<{ _id: mongoose.Types.ObjectId; totalIn: number; totalOut: number }>([
        { $match: { item: { $in: itemIds }, isVoided: { $ne: true } } },
        { $group: { _id: "$item", totalIn: { $sum: "$quantityIn" }, totalOut: { $sum: "$quantityOut" } } },
      ]),
    ]);
    const map = new Map(balances.map((row) => [String(row.item), Number(row.quantity) || 0]));
    const movementMap = new Map(movementRows.map((row) => [String(row._id), row]));
    const stock = items.map((item) => {
      const availableQuantity = map.get(String(item._id)) || 0;
      const minimumRequired = item.minimumRequired || 0;
      const needToOrder = Math.max(minimumRequired - availableQuantity, 0);
      const status = availableQuantity <= 0 ? "Out of Stock" : availableQuantity < minimumRequired ? "Low Stock" : "Available";
      const movement = movementMap.get(String(item._id));
      return { _id: item._id, name: item.name, unit: item.unit, minimumRequired, totalIn: movement?.totalIn || 0, totalOut: movement?.totalOut || 0, availableQuantity, needToOrder, status };
    });
    return NextResponse.json({ success: true, stock, summary: {
      totalItems: stock.length,
      available: stock.filter((row) => row.status === "Available").length,
      lowStock: stock.filter((row) => row.status === "Low Stock").length,
      outOfStock: stock.filter((row) => row.status === "Out of Stock").length,
    } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Failed to fetch stock" }, { status: 500 });
  }
}
