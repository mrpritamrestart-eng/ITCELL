import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";
import StationeryItem from "@/models/StationeryItem";

export const runtime = "nodejs";

const branches = Array.from({ length: 40 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");

  return {
    name: `PS/Branch ${number}`,
    code: `BR-${number}`,
    isActive: true,
  };
});

const stationeryItems = [
  { name: "A4 Paper Ream", unit: "Ream", minimumRequired: 20 },
  { name: "Blue Pen", unit: "Nos", minimumRequired: 100 },
  { name: "Black Pen", unit: "Nos", minimumRequired: 100 },
  { name: "Register", unit: "Nos", minimumRequired: 30 },
  { name: "File Cover", unit: "Nos", minimumRequired: 50 },
  { name: "Stapler", unit: "Nos", minimumRequired: 10 },
  { name: "Stapler Pin", unit: "Box", minimumRequired: 20 },
  { name: "Pencil", unit: "Nos", minimumRequired: 50 },
  { name: "Eraser", unit: "Nos", minimumRequired: 30 },
  { name: "Sharpener", unit: "Nos", minimumRequired: 30 },
  { name: "Marker", unit: "Nos", minimumRequired: 30 },
  { name: "Glue Stick", unit: "Nos", minimumRequired: 20 },
  { name: "Envelope", unit: "Nos", minimumRequired: 100 },
  { name: "Dak Pad", unit: "Nos", minimumRequired: 20 },
  { name: "Note Sheet", unit: "Bundle", minimumRequired: 20 },
  { name: "Carbon Paper", unit: "Nos", minimumRequired: 50 },
  { name: "Tag", unit: "Nos", minimumRequired: 100 },
  { name: "Paper Clip", unit: "Box", minimumRequired: 20 },
  { name: "Binder Clip", unit: "Box", minimumRequired: 20 },
  { name: "Punch Machine", unit: "Nos", minimumRequired: 10 },
  { name: "Scale", unit: "Nos", minimumRequired: 20 },
  { name: "Highlighter", unit: "Nos", minimumRequired: 20 },
  { name: "Correction Pen", unit: "Nos", minimumRequired: 20 },
  { name: "Fevicol", unit: "Nos", minimumRequired: 20 },
  { name: "Tape", unit: "Nos", minimumRequired: 20 },
  { name: "Scissor", unit: "Nos", minimumRequired: 10 },
  { name: "Calculator", unit: "Nos", minimumRequired: 5 },
  { name: "Diary", unit: "Nos", minimumRequired: 20 },
  { name: "File Board", unit: "Nos", minimumRequired: 30 },
  { name: "White Sheet", unit: "Bundle", minimumRequired: 20 },
];

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;
  try {
    if (process.env.SEED_STATIONERY_ENABLED !== "true") {
      return NextResponse.json({ success: false, message: "Seed route disabled hai. Zarurat par SEED_STATIONERY_ENABLED=true set karein." }, { status: 403 });
    }
    const body = await request.json();
    if (body.confirm !== "SEED") {
      return NextResponse.json({ success: false, message: "Confirmation text SEED required hai" }, { status: 400 });
    }
    await connectDB();

    const branchOperations = branches.map((branch) => ({
      updateOne: {
        filter: { code: branch.code },
        update: { $set: branch },
        upsert: true,
      },
    }));

    const itemOperations = stationeryItems.map((item) => ({
      updateOne: {
        filter: { name: item.name },
        update: { $set: item },
        upsert: true,
      },
    }));

    const branchResult = await Branch.bulkWrite(branchOperations);
    const itemResult = await StationeryItem.bulkWrite(itemOperations);

    return NextResponse.json({
      success: true,
      message: "Stationery master data seeded successfully",
      branches: {
        inserted: branchResult.upsertedCount,
        modified: branchResult.modifiedCount,
      },
      stationeryItems: {
        inserted: itemResult.upsertedCount,
        modified: itemResult.modifiedCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Seed operation failed",
      },
      { status: 500 }
    );
  }
}