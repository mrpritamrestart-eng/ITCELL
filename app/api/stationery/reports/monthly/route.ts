import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";
import StationeryItem from "@/models/StationeryItem";
import OutEntry from "@/models/OutEntry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeanBranch = {
  _id: mongoose.Types.ObjectId;
  name: string;
};

type LeanStationeryItem = {
  _id: mongoose.Types.ObjectId;
  name: string;
  unit: string;
};

function getCurrentMonthValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getMonthDateRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  return {
    startDate,
    endDate,
  };
}

function formatDisplayDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

export async function GET(request: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const monthValue = searchParams.get("month") || getCurrentMonthValue();

    const { startDate, endDate } = getMonthDateRange(monthValue);
    const reportEndDate = new Date(endDate);
    reportEndDate.setDate(reportEndDate.getDate() - 1);

    const branches = (await Branch.find({ isActive: true })
      .sort({ name: 1 })
      .lean()) as LeanBranch[];

    const stationeryItems = (await StationeryItem.find({ isActive: true })
      .sort({ name: 1 })
      .lean()) as LeanStationeryItem[];

    const reportData = await OutEntry.aggregate([
      {
        $match: {
          issueDate: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $unwind: "$items",
      },
      {
        $group: {
          _id: {
            branch: "$branch",
            item: "$items.item",
          },
          quantity: {
            $sum: "$items.quantity",
          },
        },
      },
    ]);

    const quantityMap = new Map<string, number>();

    reportData.forEach((entry) => {
      const key = `${String(entry._id.branch)}-${String(entry._id.item)}`;
      quantityMap.set(key, entry.quantity || 0);
    });

    const rows = branches.map((branch) => {
      const itemQuantities = stationeryItems.map((item) => {
        const key = `${String(branch._id)}-${String(item._id)}`;
        const quantity = quantityMap.get(key) || 0;

        return {
          itemId: String(item._id),
          itemName: item.name,
          unit: item.unit,
          quantity,
        };
      });

      const total = itemQuantities.reduce((sum, item) => {
        return sum + item.quantity;
      }, 0);

      return {
        branchId: String(branch._id),
        branchName: branch.name,
        itemQuantities,
        total,
      };
    });

    const itemTotals = stationeryItems.map((item) => {
      const total = rows.reduce((sum, row) => {
        const foundItem = row.itemQuantities.find(
          (rowItem) => rowItem.itemId === String(item._id)
        );

        return sum + (foundItem?.quantity || 0);
      }, 0);

      return {
        itemId: String(item._id),
        itemName: item.name,
        total,
      };
    });

    const grandTotal = itemTotals.reduce((sum, item) => {
      return sum + item.total;
    }, 0);

    return NextResponse.json({
      success: true,
      month: monthValue,
      period: {
        start: formatDisplayDate(startDate),
        end: formatDisplayDate(reportEndDate),
      },
      branches,
      stationeryItems,
      rows,
      itemTotals,
      grandTotal,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Monthly report load nahi ho payi",
      },
      { status: 500 }
    );
  }
}