import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function generateBranchCode() {
  const totalBranches = await Branch.countDocuments();
  return `BR-${String(totalBranches + 1).padStart(3, "0")}`;
}

export async function GET() {
  try {
    await connectDB();

    const branches = await Branch.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      branches,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch branches",
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
    const codeInput = String(body.code || "").trim();
    const code = codeInput || (await generateBranchCode());

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "PS/Branch name required hai",
        },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          message: "Branch code required hai",
        },
        { status: 400 }
      );
    }

    const existingName = await Branch.findOne({
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    });

    if (existingName) {
      return NextResponse.json(
        {
          success: false,
          message: "Ye PS/Branch name already exist karta hai",
        },
        { status: 400 }
      );
    }

    const existingCode = await Branch.findOne({
      code: { $regex: `^${escapeRegex(code)}$`, $options: "i" },
    });

    if (existingCode) {
      return NextResponse.json(
        {
          success: false,
          message: "Ye Branch Code already exist karta hai",
        },
        { status: 400 }
      );
    }

    const branch = await Branch.create({
      name,
      code,
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      message: "PS/Branch successfully add ho gayi",
      branch,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Branch save nahi ho payi",
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
          message: "Branch ID required hai",
        },
        { status: 400 }
      );
    }

    if (action === "delete") {
      await Branch.findByIdAndUpdate(id, {
        isActive: false,
      });

      return NextResponse.json({
        success: true,
        message: "PS/Branch list se remove ho gayi",
      });
    }

    const name = String(body.name || "").trim();
    const code = String(body.code || "").trim();

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "PS/Branch name required hai",
        },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          message: "Branch code required hai",
        },
        { status: 400 }
      );
    }

    const existingName = await Branch.findOne({
      _id: { $ne: id },
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    });

    if (existingName) {
      return NextResponse.json(
        {
          success: false,
          message: "Ye PS/Branch name already exist karta hai",
        },
        { status: 400 }
      );
    }

    const existingCode = await Branch.findOne({
      _id: { $ne: id },
      code: { $regex: `^${escapeRegex(code)}$`, $options: "i" },
    });

    if (existingCode) {
      return NextResponse.json(
        {
          success: false,
          message: "Ye Branch Code already exist karta hai",
        },
        { status: 400 }
      );
    }

    const branch = await Branch.findByIdAndUpdate(
      id,
      {
        name,
        code,
      },
      {
        new: true,
      }
    );

    return NextResponse.json({
      success: true,
      message: "PS/Branch successfully update ho gayi",
      branch,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Branch update nahi ho payi",
      },
      { status: 500 }
    );
  }
}