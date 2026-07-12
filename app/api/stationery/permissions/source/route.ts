import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import { monthBoundsUtc } from "@/lib/date-utils";
import OutEntry from "@/models/OutEntry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const month = String(request.nextUrl.searchParams.get("month") || "");
    const { start, end } = monthBoundsUtc(month);
    const rows = await OutEntry.aggregate([
      { $match: { issueDate: { $gte: start, $lt: end }, status: { $ne: "VOID" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: { branch: "$branch", branchName: "$branchName", item: "$items.item" },
          itemName: { $last: "$items.itemName" },
          unit: { $last: "$items.unit" },
          quantity: { $sum: "$items.quantity" },
        },
      },
      { $sort: { "_id.branchName": 1, itemName: 1 } },
    ]);

    const branchMap = new Map<string, { branchId: string; sourceBranchName: string; displayName: string; splitNumber: number; items: Array<{ itemId: string; itemName: string; quantity: number; unit: string }> }>();
    for (const row of rows) {
      const branchId = String(row._id.branch);
      if (!branchMap.has(branchId)) branchMap.set(branchId, { branchId, sourceBranchName: String(row._id.branchName), displayName: String(row._id.branchName), splitNumber: 1, items: [] });
      branchMap.get(branchId)?.items.push({ itemId: String(row._id.item), itemName: String(row.itemName), quantity: Number(row.quantity || 0), unit: String(row.unit) });
    }
    return NextResponse.json({ success: true, month, documents: [...branchMap.values()] });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Out records se permission data load nahi ho paya" }, { status: 400 });
  }
}
