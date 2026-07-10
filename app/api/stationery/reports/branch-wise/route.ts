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
    const branchIdsParam = searchParams.get("branchIds") || "";

    const branchIds = branchIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const { startDate, endDate } = getMonthDateRange(monthValue);

    const reportEndDate = new Date(endDate);
    reportEndDate.setDate(reportEndDate.getDate() - 1);

    const branches = (await Branch.find({ isActive: true })
      .sort({ name: 1 })
      .lean()) as LeanBranch[];

    const stationeryItems = (await StationeryItem.find({ isActive: true })
      .sort({ name: 1 })
      .lean()) as LeanStationeryItem[];

    if (branchIds.length === 0) {
      return NextResponse.json({
        success: true,
        month: monthValue,
        period: {
          start: formatDisplayDate(startDate),
          end: formatDisplayDate(reportEndDate),
        },
        branches,
        combinedSummary: [],
        branchWiseDetails: [],
        grandTotalQuantity: 0,
      });
    }

    const validBranchIds = branchIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    if (validBranchIds.length !== branchIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid branch selected",
        },
        { status: 400 }
      );
    }

    const selectedBranches = branches.filter((branch) =>
      validBranchIds.includes(String(branch._id))
    );

    const objectBranchIds = validBranchIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    const reportData = await OutEntry.aggregate([
      {
        $match: {
          branch: { $in: objectBranchIds },
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

    const branchWiseDetails = selectedBranches.map((branch) => {
      const items = stationeryItems
        .map((item) => {
          const key = `${String(branch._id)}-${String(item._id)}`;
          const quantity = quantityMap.get(key) || 0;

          return {
            itemId: String(item._id),
            itemName: item.name,
            unit: item.unit,
            quantity,
          };
        })
        .filter((item) => item.quantity > 0);

      const totalQuantity = items.reduce((sum, item) => {
        return sum + item.quantity;
      }, 0);

      return {
        branchId: String(branch._id),
        branchName: branch.name,
        items,
        totalQuantity,
      };
    });

    const combinedSummary = stationeryItems
      .map((item) => {
        const quantity = selectedBranches.reduce((sum, branch) => {
          const key = `${String(branch._id)}-${String(item._id)}`;
          return sum + (quantityMap.get(key) || 0);
        }, 0);

        return {
          itemId: String(item._id),
          itemName: item.name,
          unit: item.unit,
          quantity,
        };
      })
      .filter((item) => item.quantity > 0);

    const grandTotalQuantity = combinedSummary.reduce((sum, item) => {
      return sum + item.quantity;
    }, 0);

    return NextResponse.json({
      success: true,
      month: monthValue,
      period: {
        start: formatDisplayDate(startDate),
        end: formatDisplayDate(reportEndDate),
      },
      branches,
      combinedSummary,
      branchWiseDetails,
      grandTotalQuantity,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Branch-wise report load nahi ho payi",
      },
      { status: 500 }
    );
  }
}