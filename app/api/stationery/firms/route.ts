import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import Firm from "@/models/Firm";
import FirmPreference from "@/models/FirmPreference";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeRegex(text: string) {
  return text.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function validateFirmName(name: string) {
  if (!name) {
    return "Firm name required hai";
  }

  if (name.length > 150) {
    return "Firm name 150 characters se bada nahi ho sakta";
  }

  return "";
}

export async function GET() {
  try {
    await connectDB();

    const firms = await Firm.find({
      isActive: true,
    })
      .sort({
        name: 1,
      })
      .lean();

    return NextResponse.json({
      success: true,
      firms,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Firms load nahi ho payi",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    await connectDB();

    const body = await request.json();

    const name = String(
      body.name || ""
    ).trim();

    const nameError =
      validateFirmName(name);

    if (nameError) {
      return NextResponse.json(
        {
          success: false,
          message: nameError,
        },
        {
          status: 400,
        }
      );
    }

    const existingFirm =
      await Firm.findOne({
        name: {
          $regex: `^${escapeRegex(
            name
          )}$`,
          $options: "i",
        },
      });

    if (existingFirm?.isActive) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ye firm already exist karti hai",
        },
        {
          status: 400,
        }
      );
    }

    if (
      existingFirm &&
      !existingFirm.isActive
    ) {
      existingFirm.name = name;
      existingFirm.isActive = true;

      await existingFirm.save();

      return NextResponse.json({
        success: true,
        message:
          "Firm restore ho gayi",
        firm: existingFirm,
      });
    }

    const firm = await Firm.create({
      name,
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      message:
        "Firm successfully add ho gayi",
      firm,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Firm save nahi ho payi",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(
  request: Request
) {
  try {
    await connectDB();

    const body = await request.json();

    const id = String(
      body.id || ""
    );

    const action = String(
      body.action || "update"
    );

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid firm selected",
        },
        {
          status: 400,
        }
      );
    }

    if (action === "delete") {
      /*
       * Default order me assigned firm ko
       * direct remove nahi karne denge.
       */
      const assignedPreference =
        await FirmPreference.findOne({
          scope: "GLOBAL",

          $or: [
            {
              firstFirm: id,
            },
            {
              secondFirm: id,
            },
            {
              thirdFirm: id,
            },
          ],
        }).lean();

      if (assignedPreference) {
        return NextResponse.json(
          {
            success: false,

            message:
              "Ye firm Default Firm Order me assigned hai. Pehle Default Firm Order change ya clear karein.",
          },
          {
            status: 400,
          }
        );
      }

      const firm =
        await Firm.findByIdAndUpdate(
          id,
          {
            isActive: false,
          },
          {
            new: true,
          }
        );

      if (!firm) {
        return NextResponse.json(
          {
            success: false,
            message: "Firm nahi mili",
          },
          {
            status: 404,
          }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          "Firm list se remove ho gayi",
      });
    }

    const name = String(
      body.name || ""
    ).trim();

    const nameError =
      validateFirmName(name);

    if (nameError) {
      return NextResponse.json(
        {
          success: false,
          message: nameError,
        },
        {
          status: 400,
        }
      );
    }

    const duplicate =
      await Firm.findOne({
        _id: {
          $ne: id,
        },

        isActive: true,

        name: {
          $regex: `^${escapeRegex(
            name
          )}$`,
          $options: "i",
        },
      });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Ye firm name already exist karta hai",
        },
        {
          status: 400,
        }
      );
    }

    const firm =
      await Firm.findByIdAndUpdate(
        id,
        {
          name,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!firm) {
      return NextResponse.json(
        {
          success: false,
          message: "Firm nahi mili",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Firm update ho gayi",
      firm,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Firm update nahi ho payi",
      },
      {
        status: 500,
      }
    );
  }
}