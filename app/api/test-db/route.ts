import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = await connectDB();

    return NextResponse.json({
      success: true,
      message: "MongoDB connected successfully",
      database: db.connection.name,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Database connection failed",
      },
      { status: 500 }
    );
  }
}