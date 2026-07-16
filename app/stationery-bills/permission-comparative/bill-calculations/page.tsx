"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Firm = {
  _id: string;
  name: string;
};

type FirmPreference = {
  firstFirmId: string;
  secondFirmId: string;
  thirdFirmId: string;
};

type PermissionItem = {
  itemName: string;
  quantity: number;
  unit: string;
};

type PermissionDocument = {
  _id: string;
  displayName: string;
  items: PermissionItem[];
};

type PermissionBatch = {
  documents: PermissionDocument[];
};

type CalculationItem = {
  itemName: string;
  quantity: number;
  unit: string;
  secondFirmUnitPrice: number;
  secondFirmTotal: number;
  thirdFirmUnitPrice: number;
  thirdFirmTotal: number;
};

type Calculation = {
  _id: string;
  invoiceNo: string;
  month: string;
  selectedPermissionDocumentIds: string[];
  selectedPermissionNames: string[];

  items: CalculationItem[];

  firms: Array<{
    firm: string;
    firmName: string;
    totalAmount: number;
  }>;

  acceptedFirmIndex: number;
  status?: "ACTIVE" | "VOID";
};

type ApiResponse = {
  success: boolean;
  message?: string;
  firms?: Firm[];
  preference?: FirmPreference;
  batch?: PermissionBatch | null;
  calculations?: Calculation[];
  calculation?: Calculation;
};

type PriceState = Record<
  string,
  {
    second: string;
    third: string;
  }
>;

function getCurrentMonth() {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;
}

function makeItemKey(
  itemName: string,
  unit: string
) {
  return `${itemName
    .trim()
    .toLowerCase()}|||${unit
    .trim()
    .toLowerCase()}`;
}

function roundMoney(value: number) {
  return (
    Math.round(
      (value + Number.EPSILON) *
        100
    ) / 100
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function firmPositionName(
  index: number
) {
  if (index === 0) {
    return "1st Firm";
  }

  if (index === 1) {
    return "2nd Firm";
  }

  return "3rd Firm";
}

export default function BillCalculationsPage() {
  const [month, setMonth] =
    useState(getCurrentMonth());

  const [firms, setFirms] =
    useState<Firm[]>([]);

  const [
    defaultFirmIds,
    setDefaultFirmIds,
  ] = useState<string[]>([
    "",
    "",
    "",
  ]);

  const [
    permissions,
    setPermissions,
  ] = useState<
    PermissionDocument[]
  >([]);

  const [
    calculations,
    setCalculations,
  ] = useState<Calculation[]>([]);

  const [
    selectedPermissionIds,
    setSelectedPermissionIds,
  ] = useState<string[]>([]);

  const [firmIds, setFirmIds] =
    useState<string[]>([
      "",
      "",
      "",
    ]);

  const [
    invoiceNo,
    setInvoiceNo,
  ] = useState("");

  const [
    firstFirmAmount,
    setFirstFirmAmount,
  ] = useState("");

  const [
    acceptedFirmIndex,
    setAcceptedFirmIndex,
  ] = useState(0);

  const [prices, setPrices] =
    useState<PriceState>({});

  const [
    editingId,
    setEditingId,
  ] = useState("");

  const [message, setMessage] =
    useState("");

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const hasCompleteDefaultOrder =
    defaultFirmIds.every(Boolean) &&
    new Set(defaultFirmIds).size ===
      3;

  const loadFirmSetup =
    useCallback(async () => {
      const [
        firmsResponse,
        preferenceResponse,
      ] = await Promise.all([
        fetch(
          "/api/stationery/firms",
          {
            cache: "no-store",
          }
        ),

        fetch(
          "/api/stationery/firm-preferences",
          {
            cache: "no-store",
          }
        ),
      ]);

      const firmsData =
        (await firmsResponse.json()) as ApiResponse;

      const preferenceData =
        (await preferenceResponse.json()) as ApiResponse;

      if (
        !firmsResponse.ok ||
        !firmsData.success
      ) {
        throw new Error(
          firmsData.message ||
            "Firms load nahi ho payi"
        );
      }

      if (
        !preferenceResponse.ok ||
        !preferenceData.success
      ) {
        throw new Error(
          preferenceData.message ||
            "Default Firm Order load nahi ho paya"
        );
      }

      const nextFirms =
        firmsData.firms || [];

      const nextDefaultFirmIds = [
        preferenceData.preference
          ?.firstFirmId || "",

        preferenceData.preference
          ?.secondFirmId || "",

        preferenceData.preference
          ?.thirdFirmId || "",
      ];

      setFirms(nextFirms);

      setDefaultFirmIds(
        nextDefaultFirmIds
      );
    }, []);

  const loadMonthData =
    useCallback(
      async (
        selectedMonth: string
      ) => {
        setIsLoading(true);
        setMessage("");

        try {
          const [
            permissionResponse,
            calculationsResponse,
          ] = await Promise.all([
            fetch(
              `/api/stationery/permissions?month=${encodeURIComponent(
                selectedMonth
              )}`,
              {
                cache: "no-store",
              }
            ),

            fetch(
              `/api/stationery/quotation-calculations?month=${encodeURIComponent(
                selectedMonth
              )}`,
              {
                cache: "no-store",
              }
            ),
          ]);

          const permissionData =
            (await permissionResponse.json()) as ApiResponse;

          const calculationData =
            (await calculationsResponse.json()) as ApiResponse;

          if (
            !permissionResponse.ok ||
            !permissionData.success
          ) {
            throw new Error(
              permissionData.message ||
                "Permissions load nahi hui"
            );
          }

          if (
            !calculationsResponse.ok ||
            !calculationData.success
          ) {
            throw new Error(
              calculationData.message ||
                "Saved calculations load nahi hui"
            );
          }

          setPermissions(
            permissionData.batch
              ?.documents || []
          );

          setCalculations(
            calculationData.calculations ||
              []
          );

          setSelectedPermissionIds(
            []
          );

          setPrices({});
          setEditingId("");
          setInvoiceNo("");
          setFirmIds([
            "",
            "",
            "",
          ]);

          setFirstFirmAmount("");
          setAcceptedFirmIndex(0);
        } catch (error) {
          setPermissions([]);
          setCalculations([]);

          setMessage(
            error instanceof Error
              ? error.message
              : "Page data load nahi ho paya"
          );
        } finally {
          setIsLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    void loadFirmSetup().catch(
      (error: unknown) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Firms load nahi ho payi"
        );
      }
    );
  }, [loadFirmSetup]);

  useEffect(() => {
    void loadMonthData(month);
  }, [month, loadMonthData]);

  /*
   * New calculation form blank ho aur saved
   * default order available ho, tab default
   * three firms automatically select hongi.
   *
   * Existing saved calculation edit karte waqt
   * ye effect firms overwrite nahi karega.
   */
  useEffect(() => {
    const formHasNoFirms =
      firmIds.every(
        (firmId) => !firmId
      );

    if (
      !editingId &&
      formHasNoFirms &&
      hasCompleteDefaultOrder
    ) {
      setFirmIds([
        ...defaultFirmIds,
      ]);
    }
  }, [
    defaultFirmIds,
    editingId,
    firmIds,
    hasCompleteDefaultOrder,
  ]);

  const selectedPermissions =
    useMemo(
      () =>
        permissions.filter(
          (permission) =>
            selectedPermissionIds.includes(
              permission._id
            )
        ),
      [
        permissions,
        selectedPermissionIds,
      ]
    );

  const combinedItems =
    useMemo(() => {
      const combined =
        new Map<
          string,
          PermissionItem
        >();

      for (const permission of selectedPermissions) {
        for (const item of permission.items) {
          const key =
            makeItemKey(
              item.itemName,
              item.unit
            );

          const current =
            combined.get(key);

          if (current) {
            current.quantity =
              roundMoney(
                current.quantity +
                  Number(
                    item.quantity
                  )
              );
          } else {
            combined.set(key, {
              itemName:
                item.itemName,

              quantity: Number(
                item.quantity
              ),

              unit: item.unit,
            });
          }
        }
      }

      /*
       * Map insertion order preserve karta hai.
       *
       * Permission page par items jis order me saved hain,
       * Bill Calculations page par bhi wahi order rahega.
       * Ye existing saved bills aur new bills dono par apply hoga.
       */
      return Array.from(
        combined.values()
      );
    }, [selectedPermissions]);

  const secondFirmTotal =
    useMemo(
      () =>
        roundMoney(
          combinedItems.reduce(
            (sum, item) => {
              const price = Number(
                prices[
                  makeItemKey(
                    item.itemName,
                    item.unit
                  )
                ]?.second || 0
              );

              return (
                sum +
                item.quantity *
                  price
              );
            },
            0
          )
        ),
      [combinedItems, prices]
    );

  const thirdFirmTotal =
    useMemo(
      () =>
        roundMoney(
          combinedItems.reduce(
            (sum, item) => {
              const price = Number(
                prices[
                  makeItemKey(
                    item.itemName,
                    item.unit
                  )
                ]?.third || 0
              );

              return (
                sum +
                item.quantity *
                  price
              );
            },
            0
          )
        ),
      [combinedItems, prices]
    );

  const firstAmountNumber =
    Number(firstFirmAmount || 0);

  const totals = [
    Number.isFinite(
      firstAmountNumber
    )
      ? firstAmountNumber
      : 0,

    secondFirmTotal,
    thirdFirmTotal,
  ];

  function togglePermission(
    id: string
  ) {
    setSelectedPermissionIds(
      (current) =>
        current.includes(id)
          ? current.filter(
              (value) =>
                value !== id
            )
          : [...current, id]
    );
  }

  function updateFirm(
    index: number,
    value: string
  ) {
    if (
      value &&
      firmIds.some(
        (
          currentFirmId,
          currentIndex
        ) =>
          currentIndex !== index &&
          currentFirmId === value
      )
    ) {
      setMessage(
        "Ek firm ko do positions par select nahi kiya ja sakta."
      );

      return;
    }

    setMessage("");

    setFirmIds((current) =>
      current.map(
        (
          firmId,
          currentIndex
        ) =>
          currentIndex === index
            ? value
            : firmId
      )
    );
  }

  function applyDefaultFirmOrder() {
    if (
      !hasCompleteDefaultOrder
    ) {
      setMessage(
        "Default Firm Order available nahi hai. Add Firms page par pehle order save karein."
      );

      return;
    }

    setFirmIds([
      ...defaultFirmIds,
    ]);

    setMessage(
      "Saved Default Firm Order apply ho gaya."
    );
  }

  function updatePrice(
    key: string,
    field:
      | "second"
      | "third",
    value: string
  ) {
    setPrices((current) => ({
      ...current,

      [key]: {
        second:
          current[key]?.second ||
          "",

        third:
          current[key]?.third ||
          "",

        [field]: value,
      },
    }));
  }

  function selectLowestFirm() {
    if (
      !firstFirmAmount.trim()
    ) {
      setMessage(
        "Lowest firm select karne se pehle First Firm ki Total Amount fill karein."
      );

      return;
    }

    const minimum =
      Math.min(...totals);

    setAcceptedFirmIndex(
      totals.findIndex(
        (total) =>
          total === minimum
      )
    );

    setMessage(
      "Lowest total amount wali firm Accepted select ho gayi. Aap manually change bhi kar sakte hain."
    );
  }

  function resetForm() {
    setEditingId("");
    setInvoiceNo("");
    setSelectedPermissionIds(
      []
    );

    setFirmIds(
      hasCompleteDefaultOrder
        ? [...defaultFirmIds]
        : ["", "", ""]
    );

    setFirstFirmAmount("");
    setAcceptedFirmIndex(0);
    setPrices({});

    setMessage(
      hasCompleteDefaultOrder
        ? "New calculation form ready hai. Default Firm Order automatically apply ho gaya."
        : "New calculation form ready hai."
    );
  }

  function loadCalculation(
    calculation: Calculation
  ) {
    setEditingId(
      calculation._id
    );

    setInvoiceNo(
      calculation.invoiceNo
    );

    setSelectedPermissionIds(
      calculation.selectedPermissionDocumentIds
    );

    setFirmIds(
      calculation.firms.map(
        (firm) =>
          String(firm.firm)
      )
    );

    setFirstFirmAmount(
      String(
        calculation.firms[0]
          ?.totalAmount ?? ""
      )
    );

    setAcceptedFirmIndex(
      calculation.acceptedFirmIndex
    );

    const nextPrices: PriceState =
      {};

    for (const item of calculation.items) {
      nextPrices[
        makeItemKey(
          item.itemName,
          item.unit
        )
      ] = {
        second: String(
          item.secondFirmUnitPrice
        ),

        third: String(
          item.thirdFirmUnitPrice
        ),
      };
    }

    setPrices(nextPrices);

    setMessage(
      `Invoice ${calculation.invoiceNo} editing ke liye load ho gaya. Saved bill ka original Firm Order preserve hai.`
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  async function cancelCalculation(calculation: Calculation) {
    const reason = window.prompt(`Invoice ${calculation.invoiceNo} cancel karne ka reason likhein:`);
    if (!reason) return;
    setMessage("");
    try {
      const response = await fetch("/api/stationery/quotation-calculations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: calculation._id, action: "void", reason }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.success) throw new Error(data.message || "Calculation cancel nahi hui");
      setMessage(data.message || "Calculation cancelled");
      setCalculations((current) => current.filter((entry) => entry._id !== calculation._id));
      if (editingId === calculation._id) resetForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Calculation cancel nahi hui");
    }
  }

  async function saveCalculation() {
    setIsSaving(true);
    setMessage("");

    try {
      if (
        combinedItems.length ===
        0
      ) {
        throw new Error(
          "Kam se kam ek permission/branch select karo"
        );
      }

      if (
        firmIds.some(
          (firmId) => !firmId
        ) ||
        new Set(firmIds).size !==
          3
      ) {
        throw new Error(
          "Teen alag-alag firms select karo"
        );
      }

      for (const item of combinedItems) {
        const values =
          prices[
            makeItemKey(
              item.itemName,
              item.unit
            )
          ];

        if (
          !values?.second.trim() ||
          !values?.third.trim()
        ) {
          throw new Error(
            `${item.itemName} ke dono Unit Prices fill karo`
          );
        }
      }

      const response = await fetch(
        "/api/stationery/quotation-calculations",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            id:
              editingId ||
              undefined,

            invoiceNo,
            month,

            selectedPermissionDocumentIds:
              selectedPermissionIds,

            firmIds,

            firstFirmAmount,
            acceptedFirmIndex,

            items:
              combinedItems.map(
                (item) => {
                  const values =
                    prices[
                      makeItemKey(
                        item.itemName,
                        item.unit
                      )
                    ];

                  return {
                    itemName:
                      item.itemName,

                    unit: item.unit,

                    secondFirmUnitPrice:
                      values?.second,

                    thirdFirmUnitPrice:
                      values?.third,
                  };
                }
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
            "Calculation save nahi ho payi"
        );
      }

      setEditingId(
        data.calculation?._id ||
          editingId
      );

      setMessage(
        data.message ||
          "Calculation save ho gayi"
      );

      const refreshed =
        await fetch(
          `/api/stationery/quotation-calculations?month=${encodeURIComponent(
            month
          )}`,
          {
            cache: "no-store",
          }
        );

      const refreshedData =
        (await refreshed.json()) as ApiResponse;

      if (
        refreshed.ok &&
        refreshedData.success
      ) {
        setCalculations(
          refreshedData.calculations ||
            []
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Calculation save nahi ho payi"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              href="/stationery-bills/permission-comparative"
              className="mb-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Back to Permission and Comparative
              Quotations
            </Link>

            <h1 className="text-3xl font-bold text-gray-900">
              Bill Amount Calculations
            </h1>

            <p className="mt-2 max-w-3xl text-gray-600">
              Single ya multiple permission
              tables select karein. Saved Default
              Firm Order new calculations me
              automatically apply hoga.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
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
              onClick={resetForm}
              className="self-end rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              + New Calculation
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-900">
            {message}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl bg-white p-12 text-center font-semibold text-gray-500 shadow-sm">
            Data loading...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="space-y-6">
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">
                  Select Permissions / Branches
                </h2>

                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Selected tables ki quantities
                  item-wise add ho jayengi.
                </p>

                <div className="mt-4 max-h-[430px] overflow-y-auto rounded-xl border border-gray-200">
                  {permissions.length ===
                  0 ? (
                    <div className="p-6 text-center text-sm font-semibold text-red-600">
                      Is month ki final
                      permissions save nahi hain.
                    </div>
                  ) : (
                    permissions.map(
                      (permission) => (
                        <label
                          key={
                            permission._id
                          }
                          className="flex cursor-pointer items-start gap-3 border-b border-gray-200 p-4 last:border-b-0 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissionIds.includes(
                              permission._id
                            )}
                            onChange={() =>
                              togglePermission(
                                permission._id
                              )
                            }
                            className="mt-1 h-4 w-4"
                          />

                          <span>
                            <span className="block text-sm font-bold text-gray-900">
                              {
                                permission.displayName
                              }
                            </span>

                            <span className="mt-1 block text-xs text-gray-500">
                              {
                                permission
                                  .items
                                  .length
                              }{" "}
                              items
                            </span>
                          </span>
                        </label>
                      )
                    )
                  )}
                </div>

                <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700">
                  Selected:{" "}
                  {
                    selectedPermissionIds.length
                  }
                </div>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">
                  Saved Calculations
                </h2>

                <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">
                  {calculations.length ===
                  0 ? (
                    <p className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm font-semibold text-gray-500">
                      Is month me koi saved invoice
                      nahi hai.
                    </p>
                  ) : (
                    calculations.map(
                      (calculation) => (
                        <div key={calculation._id} className={`rounded-xl border p-3 ${editingId === calculation._id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}`}>
                          <button
                            type="button"
                            onClick={() => loadCalculation(calculation)}
                            className="w-full text-left"
                          >
                            <span className="block text-sm font-black text-gray-900">{calculation.invoiceNo}</span>
                            <span className="mt-1 block text-xs text-gray-500">{calculation.selectedPermissionNames.join(", ")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void cancelCalculation(calculation)}
                            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                          >
                            Cancel Saved Calculation
                          </button>
                        </div>
                      )
                    )
                  )}
                </div>
              </section>
            </aside>

            <div className="space-y-6">
              <section className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-amber-900">
                      Default Firm Order
                    </p>

                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      {hasCompleteDefaultOrder
                        ? "Saved default order new bill me automatically selected hai."
                        : "Default order set nahi hai. Add Firms page par order save karein."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      applyDefaultFirmOrder
                    }
                    disabled={
                      !hasCompleteDefaultOrder
                    }
                    className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-xs font-black text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Apply Default Order
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700">
                      Invoice No.
                    </label>

                    <input
                      value={invoiceNo}
                      onChange={(event) =>
                        setInvoiceNo(
                          event.target.value
                        )
                      }
                      placeholder="Enter Invoice No."
                      className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-900 outline-none focus:border-blue-500"
                    />
                  </div>

                  {[0, 1, 2].map(
                    (index) => (
                      <div key={index}>
                        <label className="block text-sm font-bold text-gray-700">
                          {firmPositionName(
                            index
                          )}
                        </label>

                        <select
                          value={
                            firmIds[
                              index
                            ]
                          }
                          onChange={(
                            event
                          ) =>
                            updateFirm(
                              index,
                              event.target
                                .value
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-900 outline-none focus:border-blue-500"
                        >
                          <option value="">
                            Select Firm
                          </option>

                          {firms.map(
                            (firm) => (
                              <option
                                key={
                                  firm._id
                                }
                                value={
                                  firm._id
                                }
                                disabled={firmIds.some(
                                  (
                                    firmId,
                                    firmIndex
                                  ) =>
                                    firmIndex !==
                                      index &&
                                    firmId ===
                                      firm._id
                                )}
                              >
                                {
                                  firm.name
                                }
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    )
                  )}
                </div>

                {firms.length < 3 && (
                  <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                    Calculation save karne ke liye
                    kam se kam 3 firms required hain.
                    Add Firms page se firms add karein.
                  </p>
                )}
              </section>

              <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="border-b border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    Item-wise Rate Calculation
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Stationery Item aur Quantity
                    permission data se automatic
                    hain.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          rowSpan={2}
                          className="border-b border-r px-4 py-3 text-left text-sm font-bold text-gray-700"
                        >
                          Stationery Item Name
                        </th>

                        <th
                          rowSpan={2}
                          className="border-b border-r px-4 py-3 text-left text-sm font-bold text-gray-700"
                        >
                          Quantity
                        </th>

                        <th
                          colSpan={2}
                          className="border-b border-r px-4 py-3 text-center text-sm font-bold text-gray-700"
                        >
                          {firms.find(
                            (firm) =>
                              firm._id ===
                              firmIds[1]
                          )?.name ||
                            "2nd Firm"}
                        </th>

                        <th
                          colSpan={2}
                          className="border-b px-4 py-3 text-center text-sm font-bold text-gray-700"
                        >
                          {firms.find(
                            (firm) =>
                              firm._id ===
                              firmIds[2]
                          )?.name ||
                            "3rd Firm"}
                        </th>
                      </tr>

                      <tr>
                        <th className="border-b border-r px-4 py-3 text-left text-xs font-bold text-gray-600">
                          Unit Price
                        </th>

                        <th className="border-b border-r px-4 py-3 text-left text-xs font-bold text-gray-600">
                          Total Amount
                        </th>

                        <th className="border-b border-r px-4 py-3 text-left text-xs font-bold text-gray-600">
                          Unit Price
                        </th>

                        <th className="border-b px-4 py-3 text-left text-xs font-bold text-gray-600">
                          Total Amount
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {combinedItems.map(
                        (item) => {
                          const key =
                            makeItemKey(
                              item.itemName,
                              item.unit
                            );

                          const secondPrice =
                            prices[key]
                              ?.second ||
                            "";

                          const thirdPrice =
                            prices[key]
                              ?.third ||
                            "";

                          return (
                            <tr
                              key={key}
                              className="hover:bg-gray-50"
                            >
                              <td className="border-b border-r px-4 py-3 text-sm font-bold text-gray-900">
                                {
                                  item.itemName
                                }

                                <span className="ml-2 text-xs font-semibold text-gray-500">
                                  (
                                  {
                                    item.unit
                                  }
                                  )
                                </span>
                              </td>

                              <td className="border-b border-r px-4 py-3 text-sm font-black text-blue-700">
                                {
                                  item.quantity
                                }
                              </td>

                              <td className="border-b border-r px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    secondPrice
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updatePrice(
                                      key,
                                      "second",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-blue-500"
                                />
                              </td>

                              <td className="border-b border-r px-4 py-3 text-sm font-black text-green-700">
                                {formatMoney(
                                  roundMoney(
                                    item.quantity *
                                      Number(
                                        secondPrice ||
                                          0
                                      )
                                  )
                                )}
                              </td>

                              <td className="border-b border-r px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    thirdPrice
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updatePrice(
                                      key,
                                      "third",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-blue-500"
                                />
                              </td>

                              <td className="border-b px-4 py-3 text-sm font-black text-green-700">
                                {formatMoney(
                                  roundMoney(
                                    item.quantity *
                                      Number(
                                        thirdPrice ||
                                          0
                                      )
                                  )
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}

                      {combinedItems.length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-12 text-center text-sm font-semibold text-gray-500"
                          >
                            Left side se one or more
                            permission tables select
                            karein.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    {combinedItems.length >
                      0 && (
                      <tfoot>
                        <tr className="bg-gray-50">
                          <td
                            colSpan={3}
                            className="border-r px-4 py-4 text-right text-sm font-black text-gray-900"
                          >
                            Total Amount
                          </td>

                          <td className="border-r px-4 py-4 text-base font-black text-green-700">
                            {formatMoney(
                              secondFirmTotal
                            )}
                          </td>

                          <td className="border-r px-4 py-4" />

                          <td className="px-4 py-4 text-base font-black text-green-700">
                            {formatMoney(
                              thirdFirmTotal
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </section>

              <section className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Firm Total Amount Summary
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      1st Firm amount manual; 2nd and
                      3rd automatic.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      selectLowestFirm
                    }
                    className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-bold text-green-800 hover:bg-green-100"
                  >
                    Select Lowest as Accepted
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full min-w-[700px] border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border-b px-4 py-3 text-left text-sm font-bold text-gray-700">
                          Firm
                        </th>

                        <th className="border-b px-4 py-3 text-left text-sm font-bold text-gray-700">
                          Name
                        </th>

                        <th className="border-b px-4 py-3 text-left text-sm font-bold text-gray-700">
                          Total Amount
                        </th>

                        <th className="border-b px-4 py-3 text-left text-sm font-bold text-gray-700">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {[0, 1, 2].map(
                        (index) => (
                          <tr key={index}>
                            <td className="border-b px-4 py-3 text-sm font-bold text-gray-700">
                              {firmPositionName(
                                index
                              )}
                            </td>

                            <td className="border-b px-4 py-3 text-sm font-bold text-gray-900">
                              {firms.find(
                                (firm) =>
                                  firm._id ===
                                  firmIds[
                                    index
                                  ]
                              )?.name ||
                                "Not Selected"}
                            </td>

                            <td className="border-b px-4 py-3">
                              {index ===
                              0 ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    firstFirmAmount
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setFirstFirmAmount(
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  placeholder="Manual amount"
                                  className="w-48 rounded-lg border border-green-400 bg-green-50 px-3 py-2 text-sm font-black text-gray-900 outline-none focus:border-green-600"
                                />
                              ) : (
                                <span className="text-sm font-black text-green-700">
                                  {formatMoney(
                                    index ===
                                      1
                                      ? secondFirmTotal
                                      : thirdFirmTotal
                                  )}
                                </span>
                              )}
                            </td>

                            <td className="border-b px-4 py-3">
                              <label className="inline-flex cursor-pointer items-center gap-2">
                                <input
                                  type="radio"
                                  name="acceptedFirm"
                                  checked={
                                    acceptedFirmIndex ===
                                    index
                                  }
                                  onChange={() =>
                                    setAcceptedFirmIndex(
                                      index
                                    )
                                  }
                                />

                                <span
                                  className={`text-sm font-black ${
                                    acceptedFirmIndex ===
                                    index
                                      ? "text-green-700"
                                      : "text-red-700"
                                  }`}
                                >
                                  {acceptedFirmIndex ===
                                  index
                                    ? "ACCEPTED"
                                    : "REJECTED"}
                                </span>
                              </label>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      void saveCalculation()
                    }
                    disabled={
                      isSaving ||
                      firms.length < 3
                    }
                    className="rounded-xl bg-blue-600 px-7 py-4 text-base font-black text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving
                      ? "Saving..."
                      : editingId
                        ? "Update Bill Calculation"
                        : "Save Bill Calculation"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
