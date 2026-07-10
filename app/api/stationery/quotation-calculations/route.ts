import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Firm from "@/models/Firm";
import PermissionBatch from "@/models/PermissionBatch";
import QuotationCalculation from "@/models/QuotationCalculation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


type PermissionDocumentRecord = {
  _id: mongoose.Types.ObjectId;
  displayName: string;
  items: Array<{
    itemName: string;
    quantity: number;
    unit: string;
  }>;
};

type IncomingPrice = {
  itemName?: string;
  unit?: string;
  secondFirmUnitPrice?: number | string;
  thirdFirmUnitPrice?: number | string;
};

function isValidMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function itemKey(itemName: string, unit: string) {
  return `${itemName.trim().toLowerCase()}|||${unit.trim().toLowerCase()}`;
}

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const id = String(searchParams.get("id") || "");
    const month = String(searchParams.get("month") || "");

    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json(
          { success: false, message: "Invalid quotation selected" },
          { status: 400 }
        );
      }

      const calculation = await QuotationCalculation.findById(id).lean();
      if (!calculation) {
        return NextResponse.json(
          { success: false, message: "Quotation calculation nahi mili" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, calculation });
    }

    const filter: { month?: string } = {};
    if (month) {
      if (!isValidMonth(month)) {
        return NextResponse.json(
          { success: false, message: "Valid month select karo" },
          { status: 400 }
        );
      }
      filter.month = month;
    }

    const calculations = await QuotationCalculation.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, calculations });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Quotation calculations load nahi ho payi",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();

    const id = String(body.id || "");
    const invoiceNo = String(body.invoiceNo || "").trim();
    const month = String(body.month || "");
    const selectedIds = Array.isArray(body.selectedPermissionDocumentIds)
      ? Array.from(
          new Set(
            body.selectedPermissionDocumentIds
              .map((value: unknown) => String(value || ""))
              .filter(Boolean)
          )
        )
      : [];
    const firmIds = Array.isArray(body.firmIds)
      ? body.firmIds.map((value: unknown) => String(value || ""))
      : [];
    const firstFirmAmount = Number(body.firstFirmAmount);
    const acceptedFirmIndex = Number(body.acceptedFirmIndex);
    const incomingPrices = Array.isArray(body.items)
      ? (body.items as IncomingPrice[])
      : [];

    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid calculation selected" },
        { status: 400 }
      );
    }

    if (!invoiceNo) {
      return NextResponse.json(
        { success: false, message: "Invoice No. required hai" },
        { status: 400 }
      );
    }

    if (invoiceNo.length > 100) {
      return NextResponse.json(
        { success: false, message: "Invoice No. 100 characters se bada nahi ho sakta" },
        { status: 400 }
      );
    }

    if (!isValidMonth(month)) {
      return NextResponse.json(
        { success: false, message: "Valid month select karo" },
        { status: 400 }
      );
    }

    if (selectedIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "Kam se kam ek permission/branch select karo" },
        { status: 400 }
      );
    }

    if (firmIds.length !== 3 || new Set(firmIds).size !== 3) {
      return NextResponse.json(
        { success: false, message: "Teen alag-alag firms select karo" },
        { status: 400 }
      );
    }

    if (firmIds.some((firmId: string) => !mongoose.Types.ObjectId.isValid(firmId))) {
      return NextResponse.json(
        { success: false, message: "One or more firms invalid hain" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(firstFirmAmount) || firstFirmAmount < 0) {
      return NextResponse.json(
        { success: false, message: "First Firm ki valid total amount fill karo" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(acceptedFirmIndex) || acceptedFirmIndex < 0 || acceptedFirmIndex > 2) {
      return NextResponse.json(
        { success: false, message: "Accepted firm select karo" },
        { status: 400 }
      );
    }

    const duplicateInvoice = await QuotationCalculation.findOne({
      ...(id ? { _id: { $ne: id } } : {}),
      invoiceNo: { $regex: `^${escapeRegex(invoiceNo)}$`, $options: "i" },
    });

    if (duplicateInvoice) {
      return NextResponse.json(
        { success: false, message: "Ye Invoice No. already use ho chuka hai" },
        { status: 400 }
      );
    }

    const permissionBatch = await PermissionBatch.findOne({ month });
    if (!permissionBatch) {
      return NextResponse.json(
        { success: false, message: "Is month ka saved permission data nahi mila" },
        { status: 400 }
      );
    }

    const selectedDocuments = permissionBatch.documents.filter((document: PermissionDocumentRecord) =>
      selectedIds.includes(String(document._id))
    );

    if (selectedDocuments.length !== selectedIds.length) {
      return NextResponse.json(
        { success: false, message: "One or more selected permissions invalid hain" },
        { status: 400 }
      );
    }

    const combinedMap = new Map<
      string,
      { itemName: string; unit: string; quantity: number }
    >();

    for (const document of selectedDocuments) {
      for (const item of document.items) {
        const key = itemKey(item.itemName, item.unit);
        const current = combinedMap.get(key);
        if (current) {
          current.quantity += Number(item.quantity);
        } else {
          combinedMap.set(key, {
            itemName: item.itemName,
            unit: item.unit,
            quantity: Number(item.quantity),
          });
        }
      }
    }

    const priceMap = new Map<string, IncomingPrice>();
    for (const price of incomingPrices) {
      const itemName = String(price.itemName || "").trim();
      const unit = String(price.unit || "").trim();
      if (itemName && unit) {
        priceMap.set(itemKey(itemName, unit), price);
      }
    }

    const items = Array.from(combinedMap.entries()).map(([key, item]) => {
      const incoming = priceMap.get(key);
      const secondFirmUnitPrice = Number(incoming?.secondFirmUnitPrice);
      const thirdFirmUnitPrice = Number(incoming?.thirdFirmUnitPrice);

      if (!Number.isFinite(secondFirmUnitPrice) || secondFirmUnitPrice < 0) {
        throw new Error(`${item.itemName} ke liye 2nd Firm ka valid Unit Price fill karo`);
      }

      if (!Number.isFinite(thirdFirmUnitPrice) || thirdFirmUnitPrice < 0) {
        throw new Error(`${item.itemName} ke liye 3rd Firm ka valid Unit Price fill karo`);
      }

      return {
        itemName: item.itemName,
        quantity: roundMoney(item.quantity),
        unit: item.unit,
        secondFirmUnitPrice: roundMoney(secondFirmUnitPrice),
        secondFirmTotal: roundMoney(item.quantity * secondFirmUnitPrice),
        thirdFirmUnitPrice: roundMoney(thirdFirmUnitPrice),
        thirdFirmTotal: roundMoney(item.quantity * thirdFirmUnitPrice),
      };
    });

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Selected permissions me stationery item nahi hai" },
        { status: 400 }
      );
    }

    const firms = await Firm.find({ _id: { $in: firmIds } }).lean();
    if (firms.length !== 3) {
      return NextResponse.json(
        { success: false, message: "One or more firms database me nahi mili" },
        { status: 400 }
      );
    }

    const firmMap = new Map(firms.map((firm) => [String(firm._id), String(firm.name)]));
    const secondFirmAmount = roundMoney(
      items.reduce((sum, item) => sum + item.secondFirmTotal, 0)
    );
    const thirdFirmAmount = roundMoney(
      items.reduce((sum, item) => sum + item.thirdFirmTotal, 0)
    );

    const quotationFirms = [
      {
        firm: firmIds[0],
        firmName: firmMap.get(firmIds[0]) || "",
        totalAmount: roundMoney(firstFirmAmount),
        amountMode: "MANUAL",
      },
      {
        firm: firmIds[1],
        firmName: firmMap.get(firmIds[1]) || "",
        totalAmount: secondFirmAmount,
        amountMode: "CALCULATED",
      },
      {
        firm: firmIds[2],
        firmName: firmMap.get(firmIds[2]) || "",
        totalAmount: thirdFirmAmount,
        amountMode: "CALCULATED",
      },
    ];

    const payload = {
      invoiceNo,
      month,
      selectedPermissionDocumentIds: selectedIds,
      selectedPermissionNames: selectedDocuments.map((document: PermissionDocumentRecord) => document.displayName),
      items,
      firms: quotationFirms,
      acceptedFirmIndex,
    };

    const calculation = id
      ? await QuotationCalculation.findByIdAndUpdate(id, payload, {
          new: true,
          runValidators: true,
        })
      : await QuotationCalculation.create(payload);

    if (!calculation) {
      return NextResponse.json(
        { success: false, message: "Calculation update nahi ho payi" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: id
        ? "Bill amount calculation update ho gayi"
        : "Bill amount calculation save ho gayi",
      calculation,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bill amount calculation save nahi ho payi";
    const isValidation =
      message.includes("fill karo") ||
      message.includes("required") ||
      message.includes("invalid") ||
      message.includes("select");
    return NextResponse.json(
      { success: false, message },
      { status: isValidation ? 400 : 500 }
    );
  }
}
