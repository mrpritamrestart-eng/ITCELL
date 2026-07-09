import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import StationeryItem from "@/models/StationeryItem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET() {
  try {
    await connectDB();

    const items = await StationeryItem.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch stationery items",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();

    const name = String(body.name || "").trim();
    const unit = String(body.unit || "").trim();
    const minimumRequired = Number(body.minimumRequired) || 0;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Stationery item name required hai",
        },
        { status: 400 }
      );
    }

    if (!unit) {
      return NextResponse.json(
        {
          success: false,
          message: "Unit required hai",
        },
        { status: 400 }
      );
    }

    if (minimumRequired < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Minimum required stock negative nahi ho sakta",
        },
        { status: 400 }
      );
    }

    const existingItem = await StationeryItem.findOne({
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    });

    if (existingItem && existingItem.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: "Ye stationery item already exist karta hai",
        },
        { status: 400 }
      );
    }

    if (existingItem && !existingItem.isActive) {
      existingItem.name = name;
      existingItem.unit = unit;
      existingItem.minimumRequired = minimumRequired;
      existingItem.isActive = true;

      await existingItem.save();

      return NextResponse.json({
        success: true,
        message: "Stationery item successfully restore ho gaya",
        item: existingItem,
      });
    }

    const item = await StationeryItem.create({
      name,
      unit,
      minimumRequired,
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      message: "Stationery item successfully add ho gaya",
      item,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Stationery item save nahi ho paya",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await connectDB();

    const body = await request.json();

    const id = body.id;
    const action = body.action;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Stationery item ID required hai",
        },
        { status: 400 }
      );
    }

    if (action === "delete") {
      await StationeryItem.findByIdAndUpdate(id, {
        isActive: false,
      });

      return NextResponse.json({
        success: true,
        message: "Stationery item list se remove ho gaya",
      });
    }

    const name = String(body.name || "").trim();
    const unit = String(body.unit || "").trim();
    const minimumRequired = Number(body.minimumRequired) || 0;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Stationery item name required hai",
        },
        { status: 400 }
      );
    }

    if (!unit) {
      return NextResponse.json(
        {
          success: false,
          message: "Unit required hai",
        },
        { status: 400 }
      );
    }

    if (minimumRequired < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Minimum required stock negative nahi ho sakta",
        },
        { status: 400 }
      );
    }

    const existingItem = await StationeryItem.findOne({
      _id: { $ne: id },
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
      isActive: true,
    });

    if (existingItem) {
      return NextResponse.json(
        {
          success: false,
          message: "Ye stationery item already exist karta hai",
        },
        { status: 400 }
      );
    }

    const item = await StationeryItem.findByIdAndUpdate(
      id,
      {
        name,
        unit,
        minimumRequired,
      },
      {
        new: true,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Stationery item successfully update ho gaya",
      item,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Stationery item update nahi ho paya",
      },
      { status: 500 }
    );
  }
}