"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type PermissionSourceType =
  | "OUT_RECORD"
  | "DUMMY";

type MasterItem = {
  _id: string;
  name: string;
  unit: string;
};

type BranchRecord = {
  _id: string;
  name: string;
  code?: string;
};

type PermissionItem = {
  clientId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
};

type PermissionDocument = {
  clientId: string;
  _id?: string;
  sourceType: PermissionSourceType;
  branchId: string;
  sourceBranchName: string;
  displayName: string;
  splitNumber: number;
  items: PermissionItem[];
};

type SourceDocument = {
  branchId: string;
  sourceBranchName: string;
  displayName: string;
  splitNumber: number;
  items: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    unit: string;
  }>;
};

type SavedBatch = {
  month: string;
  status?: "DRAFT" | "FINALIZED";
  revision?: number;
  finalizedAt?: string | null;
  documents: Array<{
    _id: string;
    sourceType?:
      | PermissionSourceType
      | string;
    branch: string;
    sourceBranchName: string;
    displayName: string;
    splitNumber: number;
    items: Array<{
      item: string;
      itemName: string;
      quantity: number;
      unit: string;
    }>;
  }>;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  items?: MasterItem[];
  branches?: BranchRecord[];
  documents?: SourceDocument[];
  batch?: SavedBatch | null;
};

function getCurrentMonth() {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;
}

function makeClientId() {
  return (
    globalThis.crypto
      ?.randomUUID?.() ||
    `${Date.now()}-${Math.random()}`
  );
}

function normalizeSourceType(
  value: unknown
): PermissionSourceType {
  return String(value).toUpperCase() ===
    "DUMMY"
    ? "DUMMY"
    : "OUT_RECORD";
}

function sourceToClient(
  documents: SourceDocument[]
): PermissionDocument[] {
  return documents.map(
    (document) => ({
      clientId: makeClientId(),
      sourceType: "OUT_RECORD",
      branchId:
        document.branchId,
      sourceBranchName:
        document.sourceBranchName,
      displayName:
        document.displayName,
      splitNumber:
        document.splitNumber,
      items: document.items.map(
        (item) => ({
          clientId:
            makeClientId(),
          ...item,
          quantity: Number(
            item.quantity
          ),
        })
      ),
    })
  );
}

function savedToClient(
  batch: SavedBatch
): PermissionDocument[] {
  return batch.documents.map(
    (document) => ({
      clientId: makeClientId(),
      _id: String(document._id),

      /*
       * Purane documents me sourceType absent hoga.
       * Unhe OUT_RECORD maana jayega.
       */
      sourceType:
        normalizeSourceType(
          document.sourceType
        ),

      branchId: String(
        document.branch
      ),

      sourceBranchName:
        document.sourceBranchName,

      displayName:
        document.displayName,

      splitNumber:
        Number(
          document.splitNumber
        ),

      items: document.items.map(
        (item) => ({
          clientId:
            makeClientId(),
          itemId: String(
            item.item
          ),
          itemName:
            item.itemName,
          quantity: Number(
            item.quantity
          ),
          unit: item.unit,
        })
      ),
    })
  );
}

function getBaseDisplayName(
  document: PermissionDocument
) {
  return document.sourceType ===
    "DUMMY"
    ? `${document.sourceBranchName}-OLD`
    : document.sourceBranchName;
}

/*
 * Sirf same Branch aur same Source Type ke
 * documents ko renumber karega.
 *
 * Dummy aur actual Out Record documents
 * ek-dusre ke names ko modify nahi karenge.
 */
function renumberDocuments(
  documents: PermissionDocument[],
  branchId: string,
  sourceType: PermissionSourceType
) {
  const matchingCount =
    documents.filter(
      (document) =>
        document.branchId ===
          branchId &&
        document.sourceType ===
          sourceType
    ).length;

  let sequence = 0;

  return documents.map(
    (document) => {
      if (
        document.branchId !==
          branchId ||
        document.sourceType !==
          sourceType
      ) {
        return document;
      }

      sequence += 1;

      const baseName =
        getBaseDisplayName(
          document
        );

      return {
        ...document,
        displayName:
          matchingCount === 1
            ? baseName
            : `${baseName}-${sequence}`,
        splitNumber: sequence,
      };
    }
  );
}

export default function PermissionsPage() {
  const [month, setMonth] =
    useState(getCurrentMonth());

  const [
    masterItems,
    setMasterItems,
  ] = useState<MasterItem[]>([]);

  const [
    branches,
    setBranches,
  ] = useState<BranchRecord[]>([]);

  const [
    documents,
    setDocuments,
  ] = useState<
    PermissionDocument[]
  >([]);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    hasSavedData,
    setHasSavedData,
  ] = useState(false);

  const [batchStatus, setBatchStatus] = useState<"DRAFT" | "FINALIZED" | "NONE">("NONE");
  const [revision, setRevision] = useState(0);
  const [isUnlocking, setIsUnlocking] = useState(false);

  /*
   * Dummy Bill modal states
   */
  const [
    isDummyModalOpen,
    setIsDummyModalOpen,
  ] = useState(false);

  const [
    selectedDummyBranchIds,
    setSelectedDummyBranchIds,
  ] = useState<string[]>([]);

  const [
    dummyBranchSearch,
    setDummyBranchSearch,
  ] = useState("");

  const loadMasterItems =
    useCallback(async () => {
      const response = await fetch(
        "/api/stationery/items",
        {
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Stationery items load nahi ho paye"
        );
      }

      setMasterItems(
        data.items || []
      );
    }, []);

  const loadBranches =
    useCallback(async () => {
      const response = await fetch(
        "/api/stationery/branches",
        {
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "PS/Branches load nahi ho payi"
        );
      }

      setBranches(
        data.branches || []
      );
    }, []);

  const loadSavedData =
    useCallback(
      async (
        selectedMonth: string
      ) => {
        setIsLoading(true);
        setMessage("");

        try {
          const response =
            await fetch(
              `/api/stationery/permissions?month=${encodeURIComponent(
                selectedMonth
              )}`,
              {
                cache: "no-store",
              }
            );

          const data =
            (await response.json()) as ApiResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
                "Permission data load nahi ho paya"
            );
          }

          if (data.batch) {
            setDocuments(
              savedToClient(
                data.batch
              )
            );

            setHasSavedData(
              true
            );
            setBatchStatus(data.batch.status || (data.batch.finalizedAt ? "FINALIZED" : "DRAFT"));
            setRevision(Number(data.batch.revision || 1));

            setMessage(
              "Is month ka saved permission data load ho gaya."
            );
          } else {
            setDocuments([]);
            setHasSavedData(
              false
            );
            setBatchStatus("NONE");
            setRevision(0);
          }
        } catch (error) {
          setDocuments([]);
          setHasSavedData(false);
          setBatchStatus("NONE");
          setRevision(0);

          setMessage(
            error instanceof Error
              ? error.message
              : "Permission data load nahi ho paya"
          );
        } finally {
          setIsLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    void Promise.all([
      loadMasterItems(),
      loadBranches(),
    ]).catch(
      (error: unknown) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Master data load nahi ho paya"
        );
      }
    );
  }, [
    loadMasterItems,
    loadBranches,
  ]);

  useEffect(() => {
    void loadSavedData(month);
  }, [
    month,
    loadSavedData,
  ]);

  const totalRows = useMemo(
    () =>
      documents.reduce(
        (sum, document) =>
          sum +
          document.items.length,
        0
      ),
    [documents]
  );

  const outRecordCount =
    useMemo(
      () =>
        documents.filter(
          (document) =>
            document.sourceType ===
            "OUT_RECORD"
        ).length,
      [documents]
    );

  const dummyCount = useMemo(
    () =>
      documents.filter(
        (document) =>
          document.sourceType ===
          "DUMMY"
      ).length,
    [documents]
  );

  const filteredBranches =
    useMemo(() => {
      const query =
        dummyBranchSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return branches;
      }

      return branches.filter(
        (branch) =>
          branch.name
            .toLowerCase()
            .includes(query) ||
          String(
            branch.code || ""
          )
            .toLowerCase()
            .includes(query)
      );
    }, [
      branches,
      dummyBranchSearch,
    ]);

  async function loadFromOutRecords() {
    const existingOutRecords =
      documents.filter(
        (document) =>
          document.sourceType ===
          "OUT_RECORD"
      );

    if (
      existingOutRecords.length >
        0 &&
      !window.confirm(
        "Current OUT RECORD permission tables ko selected month ke latest Out Records se replace karna hai? Dummy/Old Bill tables safe rahengi."
      )
    ) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response =
        await fetch(
          `/api/stationery/permissions/source?month=${encodeURIComponent(
            month
          )}`,
          {
            cache: "no-store",
          }
        );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Out records load nahi ho paye"
        );
      }

      const sourceDocuments =
        sourceToClient(
          data.documents || []
        );

      /*
       * Sirf OUT_RECORD documents replace honge.
       * Existing DUMMY documents untouched rahenge.
       */
      setDocuments(
        (current) => {
          const dummyDocuments =
            current.filter(
              (document) =>
                document.sourceType ===
                "DUMMY"
            );

          return [
            ...sourceDocuments,
            ...dummyDocuments,
          ];
        }
      );

      setHasSavedData(false);

      setMessage(
        sourceDocuments.length >
          0
          ? "Out Records se permission tables prepare ho gayi. Dummy/Old Bill tables untouched hain. Ab edit karke Save Final Permissions karein."
          : "Selected month me koi Stationery Out Record nahi mila. Existing Dummy/Old Bill tables untouched hain."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Out records load nahi ho paye"
      );
    } finally {
      setIsLoading(false);
    }
  }

  function openDummyBillModal() {
    if (
      branches.length === 0
    ) {
      setMessage(
        "Dummy Bill generate karne ke liye pehle PS/Branch master me branch add karein."
      );

      return;
    }

    setSelectedDummyBranchIds(
      []
    );

    setDummyBranchSearch("");

    setIsDummyModalOpen(
      true
    );
  }

  function closeDummyBillModal() {
    setIsDummyModalOpen(
      false
    );

    setSelectedDummyBranchIds(
      []
    );

    setDummyBranchSearch("");
  }

  function toggleDummyBranch(
    branchId: string
  ) {
    setSelectedDummyBranchIds(
      (current) =>
        current.includes(branchId)
          ? current.filter(
              (id) =>
                id !== branchId
            )
          : [
              ...current,
              branchId,
            ]
    );
  }

  function generateDummyBills() {
    if (
      selectedDummyBranchIds.length ===
      0
    ) {
      setMessage(
        "Kam se kam ek PS/Branch select karein."
      );

      return;
    }

    const selectedBranches =
      branches.filter((branch) =>
        selectedDummyBranchIds.includes(
          branch._id
        )
      );

    setDocuments((current) => {
      let nextDocuments = [
        ...current,
      ];

      selectedBranches.forEach(
        (branch) => {
          const existingDummyCount =
            nextDocuments.filter(
              (document) =>
                document.branchId ===
                  branch._id &&
                document.sourceType ===
                  "DUMMY"
            ).length;

          const nextNumber =
            existingDummyCount + 1;

          const dummyDocument: PermissionDocument =
            {
              clientId:
                makeClientId(),

              sourceType:
                "DUMMY",

              branchId:
                branch._id,

              sourceBranchName:
                branch.name,

              displayName:
                existingDummyCount ===
                0
                  ? `${branch.name}-OLD`
                  : `${branch.name}-OLD-${nextNumber}`,

              splitNumber:
                nextNumber,

              /*
               * Blank table create hogi.
               * Items user manually Add Item se add karega.
               */
              items: [],
            };

          nextDocuments = [
            ...nextDocuments,
            dummyDocument,
          ];

          nextDocuments =
            renumberDocuments(
              nextDocuments,
              branch._id,
              "DUMMY"
            );
        }
      );

      return nextDocuments;
    });

    setHasSavedData(false);

    setMessage(
      `${selectedBranches.length} Dummy/Old Bill permission table generate ho gayi. Ab Add Item button se stationery items aur quantities add karein.`
    );

    closeDummyBillModal();
  }

  function updateDocumentName(
    clientId: string,
    value: string
  ) {
    setDocuments((current) =>
      current.map((document) =>
        document.clientId ===
        clientId
          ? {
              ...document,
              displayName: value,
            }
          : document
      )
    );

    setHasSavedData(false);
  }

  function updateItem(
    documentClientId: string,
    rowClientId: string,
    field:
      | "itemId"
      | "quantity",
    value: string
  ) {
    setDocuments((current) =>
      current.map((document) => {
        if (
          document.clientId !==
          documentClientId
        ) {
          return document;
        }

        return {
          ...document,

          items:
            document.items.map(
              (row) => {
                if (
                  row.clientId !==
                  rowClientId
                ) {
                  return row;
                }

                if (
                  field ===
                  "quantity"
                ) {
                  return {
                    ...row,
                    quantity:
                      Number(value),
                  };
                }

                const selectedItem =
                  masterItems.find(
                    (item) =>
                      item._id ===
                      value
                  );

                return selectedItem
                  ? {
                      ...row,
                      itemId:
                        selectedItem._id,
                      itemName:
                        selectedItem.name,
                      unit:
                        selectedItem.unit,
                    }
                  : row;
              }
            ),
        };
      })
    );

    setHasSavedData(false);
  }

  function addItem(
    documentClientId: string
  ) {
    setMessage("");

    const targetDocument =
      documents.find(
        (document) =>
          document.clientId ===
          documentClientId
      );

    if (!targetDocument) {
      return;
    }

    const usedIds = new Set(
      targetDocument.items.map(
        (item) => item.itemId
      )
    );

    const selectedItem =
      masterItems.find(
        (item) =>
          !usedIds.has(item._id)
      );

    if (!selectedItem) {
      setMessage(
        "Is permission table me sabhi available stationery items already add hain."
      );

      return;
    }

    setDocuments((current) =>
      current.map((document) =>
        document.clientId ===
        documentClientId
          ? {
              ...document,
              items: [
                ...document.items,
                {
                  clientId:
                    makeClientId(),
                  itemId:
                    selectedItem._id,
                  itemName:
                    selectedItem.name,
                  quantity: 1,
                  unit:
                    selectedItem.unit,
                },
              ],
            }
          : document
      )
    );

    setHasSavedData(false);
  }

  function removeItem(
    documentClientId: string,
    rowClientId: string
  ) {
    setDocuments((current) =>
      current.map((document) =>
        document.clientId ===
        documentClientId
          ? {
              ...document,
              items:
                document.items.filter(
                  (row) =>
                    row.clientId !==
                    rowClientId
                ),
            }
          : document
      )
    );

    setHasSavedData(false);
  }

  function duplicateForSplit(
    documentClientId: string
  ) {
    setDocuments((current) => {
      const originalIndex =
        current.findIndex(
          (document) =>
            document.clientId ===
            documentClientId
        );

      if (originalIndex < 0) {
        return current;
      }

      const original =
        current[originalIndex];

      const clone: PermissionDocument =
        {
          ...original,
          clientId:
            makeClientId(),
          _id: undefined,

          items:
            original.items.map(
              (item) => ({
                ...item,
                clientId:
                  makeClientId(),
              })
            ),
        };

      const withClone = [
        ...current.slice(
          0,
          originalIndex + 1
        ),
        clone,
        ...current.slice(
          originalIndex + 1
        ),
      ];

      return renumberDocuments(
        withClone,
        original.branchId,
        original.sourceType
      );
    });

    setHasSavedData(false);

    setMessage(
      "Split copy create ho gayi. Dono tables me items aur quantities adjust karke records double hone se bachayein."
    );
  }

  function removePermission(
    documentClientId: string
  ) {
    const target =
      documents.find(
        (document) =>
          document.clientId ===
          documentClientId
      );

    if (!target) {
      return;
    }

    if (
      !window.confirm(
        `"${target.displayName}" permission table remove karni hai?`
      )
    ) {
      return;
    }

    setDocuments((current) => {
      const filtered =
        current.filter(
          (document) =>
            document.clientId !==
            documentClientId
        );

      return renumberDocuments(
        filtered,
        target.branchId,
        target.sourceType
      );
    });

    setHasSavedData(false);
  }

  async function savePermissions() {
    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/stationery/permissions",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            month,

            documents:
              documents.map(
                (document) => ({
                  _id:
                    document._id,

                  sourceType:
                    document.sourceType,

                  branchId:
                    document.branchId,

                  sourceBranchName:
                    document.sourceBranchName,

                  displayName:
                    document.displayName,

                  splitNumber:
                    document.splitNumber,

                  items:
                    document.items.map(
                      (item) => ({
                        itemId:
                          item.itemId,
                        quantity:
                          item.quantity,
                      })
                    ),
                })
              ),
          }),
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Permission data save nahi ho paya"
        );
      }

      setMessage(
        data.message ||
          "Permission data save ho gaya"
      );

      setHasSavedData(true);

      await loadSavedData(month);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Permission data save nahi ho paya"
      );
    } finally {
      setIsSaving(false);
    }
  }


  async function unlockPermissions() {
    const reason = window.prompt("Permission unlock/correction ka reason likhein:");
    if (!reason) return;
    setIsUnlocking(true);
    setMessage("");
    try {
      const response = await fetch("/api/stationery/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, action: "unlock", reason }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.success) throw new Error(data.message || "Unlock failed");
      setMessage(data.message || "Permissions unlock ho gayi");
      setBatchStatus("DRAFT");
      setHasSavedData(false);
      await loadSavedData(month);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Permission unlock nahi ho payi");
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/stationery-bills/permission-comparative"
              className="mb-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Back to Permission and Comparative
              Quotations
            </Link>

            <h1 className="text-3xl font-bold text-gray-900">
              Permissions
            </h1>

            <p className="mt-2 max-w-3xl text-gray-600">
              New bills ke liye monthly Out Records
              load karein. Old bills ke liye Dummy
              Bills generate karein. Dummy bills se
              original Stock, Purchase aur Out Entry
              records me koi change nahi hoga.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                Month
              </label>

              <input
                type="month"
                value={month}
                onChange={(event) =>
                  setMonth(
                    event.target.value
                  )
                }
                className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-bold text-gray-900 outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                void loadFromOutRecords()
              }
              disabled={isLoading}
              className="self-end rounded-xl border border-blue-300 bg-white px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              Load from Out Records
            </button>

            <button
              type="button"
              onClick={
                openDummyBillModal
              }
              disabled={
                isLoading ||
                branches.length === 0
              }
              className="self-end rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate Dummy Bills
            </button>

            <a
              href={`/api/stationery/permission-pdf?month=${month}`}
              className={`self-end rounded-xl px-5 py-3 text-sm font-black shadow-sm ${
                batchStatus === "FINALIZED" && documents.length > 0
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "pointer-events-none bg-gray-200 text-gray-500"
              }`}
            >
              Download Permission PDF
            </a>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Total Tables
            </p>

            <p className="mt-1 text-3xl font-black text-gray-900">
              {documents.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Out Record Bills
            </p>

            <p className="mt-1 text-3xl font-black text-blue-700">
              {outRecordCount}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Dummy / Old Bills
            </p>

            <p className="mt-1 text-3xl font-black text-amber-600">
              {dummyCount}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Item Rows
            </p>

            <p className="mt-1 text-3xl font-black text-gray-900">
              {totalRows}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Current Status
            </p>

            <p
              className={`mt-2 text-lg font-black ${
                hasSavedData
                  ? "text-green-700"
                  : "text-amber-700"
              }`}
            >
              {batchStatus === "FINALIZED"
                ? `Finalized (Rev. ${revision})`
                : batchStatus === "DRAFT"
                  ? `Draft / Unlocked (Rev. ${revision})`
                  : "Unsaved Data"}
            </p>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-900">
            {message}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl bg-white p-12 text-center font-semibold text-gray-500 shadow-sm">
            Permission data loading...
          </div>
        ) : documents.length ===
          0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
            <p className="text-lg font-bold text-gray-800">
              Permission data available nahi hai.
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              New billing ke liye “Load from Out
              Records” use karein ya old billing ke
              liye “Generate Dummy Bills” use karein.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {documents.map(
              (
                document,
                documentIndex
              ) => (
                <section
                  key={
                    document.clientId
                  }
                  className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ${
                    document.sourceType ===
                    "DUMMY"
                      ? "ring-amber-200"
                      : "ring-blue-100"
                  }`}
                >
                  <div className="flex flex-col gap-4 border-b border-gray-200 bg-gray-50 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${
                          document.sourceType ===
                          "DUMMY"
                            ? "bg-amber-500"
                            : "bg-blue-600"
                        }`}
                      >
                        {documentIndex +
                          1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
                              document.sourceType ===
                              "DUMMY"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {document.sourceType ===
                            "DUMMY"
                              ? "Dummy / Old Bill"
                              : "Out Record Bill"}
                          </span>

                          <span className="text-xs font-semibold text-gray-500">
                            Original
                            Branch:{" "}
                            {
                              document.sourceBranchName
                            }
                          </span>
                        </div>

                        <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                          Permission /
                          Bill Name
                        </label>

                        <input
                          value={
                            document.displayName
                          }
                          onChange={(
                            event
                          ) =>
                            updateDocumentName(
                              document.clientId,
                              event.target.value
                            )
                          }
                          className="mt-1 w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 font-bold text-gray-900 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          addItem(
                            document.clientId
                          )
                        }
                        className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700"
                      >
                        + Add Item
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          duplicateForSplit(
                            document.clientId
                          )
                        }
                        className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600"
                      >
                        Duplicate /
                        Split Bill
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          removePermission(
                            document.clientId
                          )
                        }
                        className="rounded-lg border border-red-300 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                      >
                        Remove Table
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse">
                      <thead className="bg-white">
                        <tr>
                          <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                            Sr.
                          </th>

                          <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                            Stationery Item
                            Name
                          </th>

                          <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                            Quantity
                          </th>

                          <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                            Unit
                          </th>

                          <th className="border-b px-4 py-4 text-right text-sm font-bold text-gray-700">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {document.items.map(
                          (
                            row,
                            rowIndex
                          ) => (
                            <tr
                              key={
                                row.clientId
                              }
                              className="hover:bg-gray-50"
                            >
                              <td className="border-b px-4 py-3 text-sm font-semibold text-gray-600">
                                {rowIndex +
                                  1}
                              </td>

                              <td className="border-b px-4 py-3">
                                <select
                                  value={
                                    row.itemId
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateItem(
                                      document.clientId,
                                      row.clientId,
                                      "itemId",
                                      event.target.value
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-blue-500"
                                >
                                  {masterItems.map(
                                    (
                                      item
                                    ) => (
                                      <option
                                        key={
                                          item._id
                                        }
                                        value={
                                          item._id
                                        }
                                      >
                                        {
                                          item.name
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              </td>

                              <td className="border-b px-4 py-3">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={
                                    row.quantity
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateItem(
                                      document.clientId,
                                      row.clientId,
                                      "quantity",
                                      event.target.value
                                    )
                                  }
                                  className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-blue-500"
                                />
                              </td>

                              <td className="border-b px-4 py-3 text-sm font-semibold text-gray-700">
                                {
                                  row.unit
                                }
                              </td>

                              <td className="border-b px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeItem(
                                      document.clientId,
                                      row.clientId
                                    )
                                  }
                                  className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          )
                        )}

                        {document.items
                          .length ===
                          0 && (
                          <tr>
                            <td
                              colSpan={
                                5
                              }
                              className="px-4 py-8 text-center text-sm font-semibold text-red-600"
                            >
                              Is permission
                              table me koi
                              item nahi hai.
                              “Add Item” use
                              karein.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )
            )}

            <div className="sticky bottom-4 flex flex-wrap justify-end gap-3">
              {batchStatus === "FINALIZED" && (
                <button
                  type="button"
                  onClick={() => void unlockPermissions()}
                  disabled={isUnlocking}
                  className="rounded-xl border border-orange-500 bg-white px-6 py-4 text-base font-black text-orange-700 shadow-lg hover:bg-orange-50 disabled:opacity-50"
                >
                  {isUnlocking ? "Unlocking..." : "Unlock for Correction"}
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  void savePermissions()
                }
                disabled={
                  isSaving ||
                  documents.length ===
                    0
                }
                className="rounded-xl bg-blue-600 px-7 py-4 text-base font-black text-white shadow-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? "Saving Final Permissions..."
                  : "Save Final Permissions"}
              </button>
            </div>
          </div>
        )}
      </div>

      {isDummyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-gray-900">
                    Generate Dummy /
                    Old Bills
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    PS/Branches select
                    karein. Inke liye blank
                    permission tables
                    create hongi. Original
                    Out Records aur Stock
                    untouched rahenge.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeDummyBillModal
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-black text-gray-700 hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              <input
                type="text"
                value={
                  dummyBranchSearch
                }
                onChange={(event) =>
                  setDummyBranchSearch(
                    event.target.value
                  )
                }
                placeholder="PS/Branch name ya code search karein..."
                className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-gray-700">
                  Active
                  PS/Branches
                </p>

                <p className="text-sm font-black text-amber-700">
                  {
                    selectedDummyBranchIds.length
                  }{" "}
                  Selected
                </p>
              </div>

              {filteredBranches.length ===
              0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm font-semibold text-gray-500">
                  Koi matching
                  PS/Branch nahi
                  mili.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredBranches.map(
                    (branch) => {
                      const isSelected =
                        selectedDummyBranchIds.includes(
                          branch._id
                        );

                      return (
                        <label
                          key={
                            branch._id
                          }
                          className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition ${
                            isSelected
                              ? "border-amber-500 bg-amber-50"
                              : "border-gray-200 hover:border-amber-300 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={
                              isSelected
                            }
                            onChange={() =>
                              toggleDummyBranch(
                                branch._id
                              )
                            }
                            className="h-5 w-5 accent-amber-500"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900">
                              {
                                branch.name
                              }
                            </p>

                            {branch.code && (
                              <p className="mt-1 text-xs font-semibold text-gray-500">
                                Branch
                                Code:{" "}
                                {
                                  branch.code
                                }
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    }
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={
                  closeDummyBillModal
                }
                className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  generateDummyBills
                }
                disabled={
                  selectedDummyBranchIds.length ===
                  0
                }
                className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-black text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate{" "}
                {
                  selectedDummyBranchIds.length
                }{" "}
                Dummy Bill
                {selectedDummyBranchIds.length ===
                1
                  ? ""
                  : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}