import { requireRouteAuth } from "@/lib/route-auth";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";
import PermissionBatch from "@/models/PermissionBatch";
import StationeryItem from "@/models/StationeryItem";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PermissionSourceType =
  | "OUT_RECORD"
  | "DUMMY";

type IncomingItem = {
  itemId?: string;
  itemName?: string;
  quantity?: number | string;
  unit?: string;
};

type IncomingDocument = {
  _id?: string;
  sourceType?: PermissionSourceType | string;
  branchId?: string;
  sourceBranchName?: string;
  displayName?: string;
  splitNumber?: number | string;
  items?: IncomingItem[];
};

function isValidMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(
    value
  );
}

function normalizeSourceType(
  value: unknown
): PermissionSourceType {
  /*
   * Purane saved documents me sourceType field nahi hogi.
   * Unhe automatically OUT_RECORD maana jayega.
   */
  const normalized = String(
    value || "OUT_RECORD"
  )
    .trim()
    .toUpperCase();

  if (
    normalized !== "OUT_RECORD" &&
    normalized !== "DUMMY"
  ) {
    throw new Error(
      "Permission source type invalid hai"
    );
  }

  return normalized;
}

export async function GET(
  request: Request
) {
  const auth = await requireRouteAuth();
  if (auth.response) return auth.response;
  try {
    await connectDB();

    const { searchParams } = new URL(
      request.url
    );

    const month = String(
      searchParams.get("month") || ""
    );

    if (!isValidMonth(month)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid month select karo",
        },
        {
          status: 400,
        }
      );
    }

    const batch =
      await PermissionBatch.findOne({
        month,
      }).lean();

    return NextResponse.json({
      success: true,
      batch,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Permission data load nahi ho paya",
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
  const auth = await requireRouteAuth();
  if (auth.response) return auth.response;
  try {
    await connectDB();

    const body = await request.json();

    const month = String(
      body.month || ""
    );

    const incomingDocuments =
      Array.isArray(body.documents)
        ? (body.documents as IncomingDocument[])
        : [];

    if (!isValidMonth(month)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Valid month select karo",
        },
        {
          status: 400,
        }
      );
    }

    if (
      incomingDocuments.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kam se kam ek PS/Branch permission required hai",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Har permission document ki branch validate hogi.
     */
    const branchIds = Array.from(
      new Set(
        incomingDocuments.map(
          (document) =>
            String(
              document.branchId || ""
            )
        )
      )
    );

    if (
      branchIds.some(
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
            "One or more PS/Branches invalid hain",
        },
        {
          status: 400,
        }
      );
    }

    const branches = await Branch.find({
      _id: {
        $in: branchIds,
      },
    }).lean();

    if (
      branches.length !==
      branchIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "One or more PS/Branches database me nahi mili",
        },
        {
          status: 400,
        }
      );
    }

    const branchMap = new Map(
      branches.map((branch) => [
        String(branch._id),
        String(branch.name),
      ])
    );

    /*
     * Sabhi selected stationery items collect karein.
     */
    const allItemIds = Array.from(
      new Set(
        incomingDocuments.flatMap(
          (document) =>
            (
              document.items || []
            )
              .map((item) =>
                String(
                  item.itemId || ""
                )
              )
              .filter(Boolean)
        )
      )
    );

    if (
      allItemIds.some(
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
            "One or more stationery items invalid hain",
        },
        {
          status: 400,
        }
      );
    }

    const dbItems =
      allItemIds.length > 0
        ? await StationeryItem.find({
            _id: {
              $in: allItemIds,
            },
          }).lean()
        : [];

    if (
      dbItems.length !==
      allItemIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "One or more stationery items database me nahi mile",
        },
        {
          status: 400,
        }
      );
    }

    const itemMap = new Map(
      dbItems.map((item) => [
        String(item._id),
        {
          name: String(item.name),
          unit: String(item.unit),
        },
      ])
    );

    /*
     * Frontend documents ko database-safe
     * documents me convert karein.
     */
    const documents =
      incomingDocuments.map(
        (
          document,
          documentIndex
        ) => {
          const sourceType =
            normalizeSourceType(
              document.sourceType
            );

          const branchId = String(
            document.branchId || ""
          );

          /*
           * Branch name frontend se trust nahi karna.
           * Current database branch name use hoga.
           */
          const sourceBranchName =
            branchMap.get(branchId) || "";

          const displayName = String(
            document.displayName || ""
          ).trim();

          const splitNumber = Number(
            document.splitNumber || 1
          );

          const items = Array.isArray(
            document.items
          )
            ? document.items
            : [];

          if (!sourceBranchName) {
            throw new Error(
              `Permission ${
                documentIndex + 1
              } ki branch invalid hai`
            );
          }

          if (!displayName) {
            throw new Error(
              `Permission ${
                documentIndex + 1
              } me display name required hai`
            );
          }

          if (
            !Number.isInteger(
              splitNumber
            ) ||
            splitNumber < 1
          ) {
            throw new Error(
              `Permission ${
                documentIndex + 1
              } ka split number invalid hai`
            );
          }

          if (items.length === 0) {
            throw new Error(
              `${displayName} me kam se kam ek stationery item required hai`
            );
          }

          const usedItemIds =
            new Set<string>();

          const normalizedItems =
            items.map(
              (
                item,
                itemIndex
              ) => {
                const itemId =
                  String(
                    item.itemId || ""
                  );

                const dbItem =
                  itemMap.get(
                    itemId
                  );

                const quantity =
                  Number(
                    item.quantity
                  );

                if (!dbItem) {
                  throw new Error(
                    `${displayName} ki row ${
                      itemIndex + 1
                    } me item invalid hai`
                  );
                }

                if (
                  usedItemIds.has(
                    itemId
                  )
                ) {
                  throw new Error(
                    `${displayName} me "${dbItem.name}" item duplicate add hai`
                  );
                }

                usedItemIds.add(
                  itemId
                );

                if (
                  !Number.isFinite(
                    quantity
                  ) ||
                  quantity <= 0
                ) {
                  throw new Error(
                    `${displayName} ki row ${
                      itemIndex + 1
                    } me quantity 0 se jyada honi chahiye`
                  );
                }

                return {
                  item: itemId,
                  itemName:
                    dbItem.name,
                  quantity,
                  unit: dbItem.unit,
                };
              }
            );

          return {
            ...(document._id &&
            mongoose.Types.ObjectId.isValid(
              document._id
            )
              ? {
                  _id: document._id,
                }
              : {}),

            sourceType,
            branch: branchId,
            sourceBranchName,
            displayName,
            splitNumber,
            items:
              normalizedItems,
          };
        }
      );

    /*
     * Dummy documents sirf PermissionBatch me save hote hain.
     *
     * Yahan OutEntry, StockTransaction,
     * StockBalance ya Purchase model ko touch nahi kiya gaya.
     */
    const batch =
      await PermissionBatch.findOneAndUpdate(
        {
          month,
        },
        {
          $set: {
            month,
            documents,
            status: "FINALIZED",
            finalizedAt: new Date(),
            finalizedBy: auth.session?.username || "admin",
            unlockedAt: null,
            unlockedBy: "",
          },
          $inc: { revision: 1 },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

    await writeAuditLog({
      action: "FINALIZE",
      entityType: "PermissionBatch",
      entityId: String(batch?._id || ""),
      performedBy: auth.session?.username || "admin",
      summary: `${month} permissions finalized (revision ${batch?.revision || 1})`,
      metadata: { documentCount: documents.length },
    });

    return NextResponse.json({
      success: true,
      message: "Permission data successfully finalize ho gaya",
      batch,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Permission data save nahi ho paya";

    const isValidationError =
      /required|invalid|duplicate|kam se kam|0 se jyada|database me nahi/i.test(
        message
      );

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: isValidationError
          ? 400
          : 500,
      }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireRouteAuth();
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const body = await request.json();
    const month = String(body.month || "");
    if (!isValidMonth(month)) {
      return NextResponse.json({ success: false, message: "Valid month select karo" }, { status: 400 });
    }
    if (body.action !== "unlock") {
      return NextResponse.json({ success: false, message: "Unsupported action" }, { status: 400 });
    }
    const reason = String(body.reason || "").trim();
    if (reason.length < 5) {
      return NextResponse.json({ success: false, message: "Unlock reason kam se kam 5 characters ka hona chahiye" }, { status: 400 });
    }
    const batch = await PermissionBatch.findOneAndUpdate(
      { month },
      { $set: { status: "DRAFT", finalizedAt: null, unlockedAt: new Date(), unlockedBy: auth.session?.username || "admin" } },
      { new: true }
    );
    if (!batch) return NextResponse.json({ success: false, message: "Permission batch nahi mila" }, { status: 404 });
    await writeAuditLog({ action: "UNLOCK", entityType: "PermissionBatch", entityId: String(batch._id), performedBy: auth.session?.username || "admin", summary: `${month} permissions unlocked`, metadata: { reason } });
    return NextResponse.json({ success: true, message: "Permissions editing/correction ke liye unlock ho gayi", batch });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Permission unlock nahi ho payi" }, { status: 500 });
  }
}
