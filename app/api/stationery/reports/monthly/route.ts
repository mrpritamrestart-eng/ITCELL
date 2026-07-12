import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import { currentMonthInIndia, formatDateIndia, monthBoundsUtc } from "@/lib/date-utils";
import Branch from "@/models/Branch";
import StationeryItem from "@/models/StationeryItem";
import OutEntry from "@/models/OutEntry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BranchInfo = { _id: mongoose.Types.ObjectId; name: string; code?: string };
type ItemInfo = { _id: mongoose.Types.ObjectId; name: string; unit: string };

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const month = request.nextUrl.searchParams.get("month") || currentMonthInIndia();
    const { start, end } = monthBoundsUtc(month);
    const [activeBranches, activeItems, entries] = await Promise.all([
      Branch.find({ isActive: true }).sort({ name: 1 }).lean() as unknown as Promise<BranchInfo[]>,
      StationeryItem.find({ isActive: true }).sort({ name: 1 }).lean() as unknown as Promise<ItemInfo[]>,
      OutEntry.find({ issueDate: { $gte: start, $lt: end }, status: { $ne: "VOID" } }).lean(),
    ]);

    const branchMap = new Map<string, { _id: string; name: string; code: string }>();
    activeBranches.forEach((branch) => branchMap.set(String(branch._id), { _id: String(branch._id), name: branch.name, code: branch.code || "" }));
    const itemMap = new Map<string, { _id: string; name: string; unit: string }>();
    activeItems.forEach((item) => itemMap.set(String(item._id), { _id: String(item._id), name: item.name, unit: item.unit }));
    const quantityMap = new Map<string, number>();

    for (const entry of entries) {
      const branchId = String(entry.branch);
      if (!branchMap.has(branchId)) branchMap.set(branchId, { _id: branchId, name: entry.branchName, code: entry.branchCode || "" });
      for (const item of entry.items) {
        const itemId = String(item.item);
        if (!itemMap.has(itemId)) itemMap.set(itemId, { _id: itemId, name: item.itemName, unit: item.unit });
        const key = `${branchId}-${itemId}`;
        quantityMap.set(key, (quantityMap.get(key) || 0) + Number(item.quantity || 0));
      }
    }

    const branches = [...branchMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    const stationeryItems = [...itemMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    const rows = branches.map((branch) => {
      const itemQuantities = stationeryItems.map((item) => ({
        itemId: item._id,
        itemName: item.name,
        unit: item.unit,
        quantity: quantityMap.get(`${branch._id}-${item._id}`) || 0,
      }));
      const unitTotals = Object.entries(itemQuantities.reduce<Record<string, number>>((acc, item) => {
        if (item.quantity > 0) acc[item.unit] = (acc[item.unit] || 0) + item.quantity;
        return acc;
      }, {})).map(([unit, total]) => ({ unit, total }));
      return {
        branchId: branch._id,
        branchName: branch.name,
        branchCode: branch.code,
        itemQuantities,
        unitTotals,
        total: unitTotals.length === 1 ? unitTotals[0].total : null,
        mixedUnits: unitTotals.length > 1,
      };
    });
    const itemTotals = stationeryItems.map((item) => ({
      itemId: item._id,
      itemName: item.name,
      unit: item.unit,
      total: rows.reduce((sum, row) => sum + (row.itemQuantities.find((entry) => entry.itemId === item._id)?.quantity || 0), 0),
    }));
    const unitTotals = Object.entries(itemTotals.reduce<Record<string, number>>((acc, item) => {
      acc[item.unit] = (acc[item.unit] || 0) + item.total;
      return acc;
    }, {})).map(([unit, total]) => ({ unit, total }));
    const reportEnd = new Date(end.getTime() - 1);

    return NextResponse.json({
      success: true,
      month,
      period: { start: formatDateIndia(start), end: formatDateIndia(reportEnd) },
      branches,
      stationeryItems,
      rows,
      itemTotals,
      unitTotals,
      grandTotal: unitTotals.length === 1 ? unitTotals[0].total : null,
      mixedUnits: unitTotals.length > 1,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Monthly report load nahi ho payi" }, { status: 500 });
  }
}
