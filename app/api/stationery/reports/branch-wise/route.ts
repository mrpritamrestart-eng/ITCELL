import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import { currentMonthInIndia, formatDateIndia, monthBoundsUtc } from "@/lib/date-utils";
import Branch from "@/models/Branch";
import OutEntry from "@/models/OutEntry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const month = request.nextUrl.searchParams.get("month") || currentMonthInIndia();
    const branchIds = (request.nextUrl.searchParams.get("branchIds") || "").split(",").map((id) => id.trim()).filter(Boolean);
    if (branchIds.some((id) => !mongoose.isValidObjectId(id))) throw new Error("Invalid branch selected");
    const { start, end } = monthBoundsUtc(month);

    const [activeBranches, monthEntries] = await Promise.all([
      Branch.find({ isActive: true }).sort({ name: 1 }).lean(),
      OutEntry.find({ issueDate: { $gte: start, $lt: end }, status: { $ne: "VOID" } }).lean(),
    ]);
    const branchMap = new Map<string, { _id: string; name: string; code: string }>();
    activeBranches.forEach((branch) => branchMap.set(String(branch._id), { _id: String(branch._id), name: branch.name, code: branch.code || "" }));
    monthEntries.forEach((entry) => {
      const id = String(entry.branch);
      if (!branchMap.has(id)) branchMap.set(id, { _id: id, name: entry.branchName, code: entry.branchCode || "" });
    });
    const branches = [...branchMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    const reportEnd = new Date(end.getTime() - 1);

    if (!branchIds.length) {
      return NextResponse.json({ success: true, month, period: { start: formatDateIndia(start), end: formatDateIndia(reportEnd) }, branches, combinedSummary: [], branchWiseDetails: [], unitTotals: [] });
    }

    const selected = new Set(branchIds);
    const selectedEntries = monthEntries.filter((entry) => selected.has(String(entry.branch)));
    const detailMap = new Map<string, { branchId: string; branchName: string; branchCode: string; items: Map<string, { itemId: string; itemName: string; unit: string; quantity: number }> }>();
    for (const branchId of branchIds) {
      const branch = branchMap.get(branchId);
      if (branch) detailMap.set(branchId, { branchId, branchName: branch.name, branchCode: branch.code, items: new Map() });
    }
    for (const entry of selectedEntries) {
      const detail = detailMap.get(String(entry.branch));
      if (!detail) continue;
      for (const item of entry.items) {
        const id = String(item.item);
        const current = detail.items.get(id);
        detail.items.set(id, { itemId: id, itemName: item.itemName, unit: item.unit, quantity: (current?.quantity || 0) + Number(item.quantity || 0) });
      }
    }

    const branchWiseDetails = [...detailMap.values()].map((detail) => {
      const items = [...detail.items.values()].sort((a, b) => a.itemName.localeCompare(b.itemName));
      const unitTotals = Object.entries(items.reduce<Record<string, number>>((acc, item) => {
        if (item.quantity > 0) acc[item.unit] = (acc[item.unit] || 0) + item.quantity;
        return acc;
      }, {})).map(([unit, total]) => ({ unit, total }));
      return {
        branchId: detail.branchId,
        branchName: detail.branchName,
        branchCode: detail.branchCode,
        items,
        unitTotals,
        totalQuantity: unitTotals.length === 1 ? unitTotals[0].total : null,
        mixedUnits: unitTotals.length > 1,
      };
    });
    const combinedMap = new Map<string, { itemId: string; itemName: string; unit: string; quantity: number }>();
    branchWiseDetails.forEach((detail) => detail.items.forEach((item) => {
      const current = combinedMap.get(item.itemId);
      combinedMap.set(item.itemId, { ...item, quantity: (current?.quantity || 0) + item.quantity });
    }));
    const combinedSummary = [...combinedMap.values()].sort((a, b) => a.itemName.localeCompare(b.itemName));
    const unitTotals = Object.entries(combinedSummary.reduce<Record<string, number>>((acc, item) => {
      acc[item.unit] = (acc[item.unit] || 0) + item.quantity;
      return acc;
    }, {})).map(([unit, total]) => ({ unit, total }));

    return NextResponse.json({ success: true, month, period: { start: formatDateIndia(start), end: formatDateIndia(reportEnd) }, branches, combinedSummary, branchWiseDetails, unitTotals, grandTotalQuantity: unitTotals.length === 1 ? unitTotals[0].total : null, mixedUnits: unitTotals.length > 1 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Branch-wise report load nahi ho payi" }, { status: 400 });
  }
}
