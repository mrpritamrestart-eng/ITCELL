import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import Firm from "@/models/Firm";
import FirmPreference from "@/models/FirmPreference";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FirmPreferenceRecord = {
  firstFirm: mongoose.Types.ObjectId;
  secondFirm: mongoose.Types.ObjectId;
  thirdFirm: mongoose.Types.ObjectId;
};

function emptyPreference() {
  return {
    firstFirmId: "",
    secondFirmId: "",
    thirdFirmId: "",
  };
}

export async function GET() {
  try {
    await connectDB();

    const savedPreference =
      (await FirmPreference.findOne({
        scope: "GLOBAL",
      }).lean()) as
        | FirmPreferenceRecord
        | null;

    if (!savedPreference) {
      return NextResponse.json({
        success: true,
        preference: emptyPreference(),
      });
    }

    const firmIds = [
      String(savedPreference.firstFirm),
      String(savedPreference.secondFirm),
      String(savedPreference.thirdFirm),
    ];

    /*
     * Sirf currently active firms ko default
     * order me valid maana jayega.
     */
    const activeFirms = await Firm.find({
      _id: {
        $in: firmIds,
      },
      isActive: true,
    })
      .select("_id")
      .lean();

    const activeFirmIds = new Set(
      activeFirms.map((firm) =>
        String(firm._id)
      )
    );

    return NextResponse.json({
      success: true,

      preference: {
        firstFirmId: activeFirmIds.has(
          firmIds[0]
        )
          ? firmIds[0]
          : "",

        secondFirmId: activeFirmIds.has(
          firmIds[1]
        )
          ? firmIds[1]
          : "",

        thirdFirmId: activeFirmIds.has(
          firmIds[2]
        )
          ? firmIds[2]
          : "",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Default Firm Order load nahi ho paya",
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

    const firstFirmId = String(
      body.firstFirmId || ""
    );

    const secondFirmId = String(
      body.secondFirmId || ""
    );

    const thirdFirmId = String(
      body.thirdFirmId || ""
    );

    const firmIds = [
      firstFirmId,
      secondFirmId,
      thirdFirmId,
    ];

    if (firmIds.some((id) => !id)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "First Firm, Second Firm aur Third Firm teeno select karein",
        },
        {
          status: 400,
        }
      );
    }

    if (
      firmIds.some(
        (id) =>
          !mongoose.Types.ObjectId.isValid(
            id
          )
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "One or more selected firms invalid hain",
        },
        {
          status: 400,
        }
      );
    }

    if (
      new Set(firmIds).size !== 3
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "First, Second aur Third position par teen alag-alag firms select karein",
        },
        {
          status: 400,
        }
      );
    }

    const activeFirms = await Firm.find({
      _id: {
        $in: firmIds,
      },
      isActive: true,
    })
      .select("_id")
      .lean();

    if (activeFirms.length !== 3) {
      return NextResponse.json(
        {
          success: false,
          message:
            "One or more selected firms active firm list me nahi hain",
        },
        {
          status: 400,
        }
      );
    }

    await FirmPreference.findOneAndUpdate(
      {
        scope: "GLOBAL",
      },
      {
        scope: "GLOBAL",
        firstFirm: firstFirmId,
        secondFirm: secondFirmId,
        thirdFirm: thirdFirmId,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return NextResponse.json({
      success: true,

      message:
        "Default Firm Order successfully save ho gaya",

      preference: {
        firstFirmId,
        secondFirmId,
        thirdFirmId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Default Firm Order save nahi ho paya",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE() {
  try {
    await connectDB();

    await FirmPreference.findOneAndDelete({
      scope: "GLOBAL",
    });

    return NextResponse.json({
      success: true,
      message:
        "Default Firm Order clear ho gaya",
      preference: emptyPreference(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Default Firm Order clear nahi ho paya",
      },
      {
        status: 500,
      }
    );
  }
}