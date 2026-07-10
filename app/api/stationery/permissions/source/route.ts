import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutEntry from "@/models/OutEntry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  return {
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 1),
  };
}

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const month = String(searchParams.get("month") || "");

    if (!isValidMonth(month)) {
      return NextResponse.json(
        { success: false, message: "Valid month select karo" },
        { status: 400 }
      );
    }

    const { startDate, endDate } = getMonthRange(month);

    const rows = await OutEntry.aggregate([
      {
        $match: {
          issueDate: { $gte: startDate, $lt: endDate },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            branch: "$branch",
            branchName: "$branchName",
            item: "$items.item",
            itemName: "$items.itemName",
            unit: "$items.unit",
          },
          quantity: { $sum: "$items.quantity" },
        },
      },
      { $sort: { "_id.branchName": 1, "_id.itemName": 1 } },
    ]);

    const branchMap = new Map<
      string,
      {
        branchId: string;
        sourceBranchName: string;
        displayName: string;
        splitNumber: number;
        items: Array<{
          itemId: string;
          itemName: string;
          quantity: number;
          unit: string;
        }>;
      }
    >();

    for (const row of rows) {
      const branchId = String(row._id.branch);
      if (!branchMap.has(branchId)) {
        branchMap.set(branchId, {
          branchId,
          sourceBranchName: String(row._id.branchName),
          displayName: String(row._id.branchName),
          splitNumber: 1,
          items: [],
        });
      }

      branchMap.get(branchId)?.items.push({
        itemId: String(row._id.item),
        itemName: String(row._id.itemName),
        quantity: Number(row.quantity || 0),
        unit: String(row._id.unit),
      });
    }

    return NextResponse.json({
      success: true,
      month,
      documents: Array.from(branchMap.values()),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Out records se permission data load nahi ho paya",
      },
      { status: 500 }
    );
  }
}
