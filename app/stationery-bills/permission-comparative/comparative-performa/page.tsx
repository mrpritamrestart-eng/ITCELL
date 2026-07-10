"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Calculation = {
  _id: string;
  invoiceNo: string;
  month: string;
  selectedPermissionNames: string[];
  items: Array<{
    itemName: string;
    quantity: number;
    unit: string;
  }>;
  firms: Array<{
    firmName: string;
    totalAmount: number;
  }>;
  acceptedFirmIndex: number;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  calculations?: Calculation[];
};

function getCurrentMonth() {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;
}

async function getErrorMessage(
  response: Response,
  fallbackMessage: string
) {
  try {
    const contentType =
      response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data =
        (await response.json()) as ApiResponse;

      return data.message || fallbackMessage;
    }

    const text = await response.text();

    if (
      !text ||
      text.trim().startsWith("<!DOCTYPE") ||
      text.trim().startsWith("<html")
    ) {
      return fallbackMessage;
    }

    return text.slice(0, 300);
  } catch {
    return fallbackMessage;
  }
}

function sanitizeFilename(value: string) {
  return (
    String(value || "")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      .replace(/\s+/g, " ")
      .trim() || "Comparative-Quotation"
  );
}

export default function ComparativePerformaPage() {
  const [month, setMonth] =
    useState(getCurrentMonth());

  const [calculations, setCalculations] =
    useState<Calculation[]>([]);

  const [selectedId, setSelectedId] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [previewError, setPreviewError] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(true);

  const [isPreviewLoading, setIsPreviewLoading] =
    useState(false);

  const [isDownloading, setIsDownloading] =
    useState(false);

  const [previewUrl, setPreviewUrl] =
    useState("");

  /*
   * Generated PDF Blob URL ko safely revoke
   * karne ke liye reference.
   */
  const previewObjectUrlRef =
    useRef<string | null>(null);

  const loadCalculations = useCallback(
    async (selectedMonth: string) => {
      setIsLoading(true);
      setMessage("");
      setPreviewError("");

      try {
        const response = await fetch(
          `/api/stationery/quotation-calculations?month=${encodeURIComponent(
            selectedMonth
          )}`,
          {
            cache: "no-store",
          }
        );

        const contentType =
          response.headers.get("content-type") || "";

        if (
          !response.ok ||
          !contentType.includes("application/json")
        ) {
          const errorMessage =
            await getErrorMessage(
              response,
              "Saved calculations load nahi hui"
            );

          throw new Error(errorMessage);
        }

        const data =
          (await response.json()) as ApiResponse;

        if (!data.success) {
          throw new Error(
            data.message ||
              "Saved calculations load nahi hui"
          );
        }

        const nextCalculations =
          data.calculations || [];

        setCalculations(nextCalculations);

        setSelectedId(
          nextCalculations[0]?._id || ""
        );
      } catch (error) {
        setCalculations([]);
        setSelectedId("");

        setMessage(
          error instanceof Error
            ? error.message
            : "Saved calculations load nahi hui"
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadCalculations(month);
  }, [month, loadCalculations]);

  const selectedCalculation = useMemo(
    () =>
      calculations.find(
        (calculation) =>
          calculation._id === selectedId
      ) || null,
    [calculations, selectedId]
  );

  const selectedCalculationId =
    selectedCalculation?._id || "";

  /*
   |--------------------------------------------------------------------------
   | Actual PDF preview
   |--------------------------------------------------------------------------
   | Ye wahi PDF API call karta hai jo download button use karta hai.
   | Isliye preview aur downloaded PDF bilkul same rahenge.
   */
  useEffect(() => {
    let cancelled = false;

    /*
     * Purana preview URL remove karein.
     */
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(
        previewObjectUrlRef.current
      );

      previewObjectUrlRef.current = null;
    }

    setPreviewUrl("");
    setPreviewError("");

    if (!selectedCalculationId) {
      setIsPreviewLoading(false);
      return;
    }

    async function loadPdfPreview() {
      setIsPreviewLoading(true);

      try {
        const response = await fetch(
          `/api/stationery/comparative-quotation-pdf?id=${encodeURIComponent(
            selectedCalculationId
          )}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const errorMessage =
            await getErrorMessage(
              response,
              "PDF preview load nahi ho paya"
            );

          throw new Error(errorMessage);
        }

        const contentType =
          response.headers.get("content-type") || "";

        if (
          !contentType.includes("application/pdf")
        ) {
          throw new Error(
            "Server se valid PDF response nahi mila"
          );
        }

        const pdfBlob = await response.blob();

        const objectUrl =
          URL.createObjectURL(pdfBlob);

        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        previewObjectUrlRef.current =
          objectUrl;

        setPreviewUrl(objectUrl);
      } catch (error) {
        if (!cancelled) {
          setPreviewError(
            error instanceof Error
              ? error.message
              : "PDF preview load nahi ho paya"
          );
        }
      } finally {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      }
    }

    void loadPdfPreview();

    return () => {
      cancelled = true;

      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(
          previewObjectUrlRef.current
        );

        previewObjectUrlRef.current = null;
      }
    };
  }, [selectedCalculationId]);

  /*
   |--------------------------------------------------------------------------
   | Download existing generated PDF
   |--------------------------------------------------------------------------
   */
  async function downloadPdf() {
    if (
      !selectedCalculation ||
      !previewUrl
    ) {
      return;
    }

    setIsDownloading(true);
    setMessage("");

    try {
      const anchor =
        document.createElement("a");

      anchor.href = previewUrl;

      anchor.download = `${sanitizeFilename(
        selectedCalculation.invoiceNo
      )}.pdf`;

      document.body.appendChild(anchor);

      anchor.click();
      anchor.remove();

      setMessage(
        `PDF "${selectedCalculation.invoiceNo}.pdf" download ho gayi.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "PDF download nahi ho payi"
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-200 px-4 py-8 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              href="/stationery-bills/permission-comparative"
              className="mb-3 inline-block text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              ← Back to Permission and Comparative
              Quotations
            </Link>

            <h1 className="text-3xl font-bold text-gray-900">
              Comparative Quotation and Member
              Performa
            </h1>

            <p className="mt-2 max-w-3xl text-gray-700">
              Saved invoice select karke clear
              two-page PDF preview dekhein aur
              download karein.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-600">
                Month
              </label>

              <input
                type="month"
                value={month}
                onChange={(event) =>
                  setMonth(event.target.value)
                }
                className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-bold text-gray-900 outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={() => void downloadPdf()}
              disabled={
                !selectedCalculation ||
                !previewUrl ||
                isPreviewLoading ||
                isDownloading
              }
              className="self-end rounded-xl bg-blue-700 px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDownloading
                ? "Downloading..."
                : isPreviewLoading
                  ? "Preparing PDF..."
                  : "Download Two-Page PDF"}
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl bg-white p-5 shadow-sm xl:sticky xl:top-6">
            <h2 className="text-lg font-bold text-gray-900">
              Select Invoice
            </h2>

            <p className="mt-1 text-xs leading-5 text-gray-500">
              PDF ka filename selected Invoice
              No. ke naam se hoga.
            </p>

            <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto">
              {isLoading ? (
                <p className="p-6 text-center text-sm font-semibold text-gray-500">
                  Invoices loading...
                </p>
              ) : calculations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center">
                  <p className="text-sm font-bold text-gray-700">
                    Saved invoice nahi mila.
                  </p>

                  <Link
                    href="/stationery-bills/permission-comparative/bill-calculations"
                    className="mt-3 inline-block text-sm font-bold text-blue-700"
                  >
                    Create Bill Calculation →
                  </Link>
                </div>
              ) : (
                calculations.map(
                  (calculation) => (
                    <button
                      key={calculation._id}
                      type="button"
                      onClick={() =>
                        setSelectedId(
                          calculation._id
                        )
                      }
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        selectedId ===
                        calculation._id
                          ? "border-blue-600 bg-blue-50 shadow-sm"
                          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                      }`}
                    >
                      <span className="block text-sm font-black text-gray-900">
                        {calculation.invoiceNo}
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-gray-500">
                        {calculation.selectedPermissionNames.join(
                          ", "
                        )}
                      </span>
                    </button>
                  )
                )
              )}
            </div>
          </aside>

          <section className="min-w-0">
            {!selectedCalculation ? (
              <div className="rounded-2xl bg-white p-12 text-center font-semibold text-gray-500 shadow-sm">
                Preview ke liye saved invoice
                select karein.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-neutral-800 shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-700 bg-neutral-900 px-5 py-3">
                  <div>
                    <p className="text-sm font-bold text-white">
                      Clear PDF Preview
                    </p>

                    <p className="mt-0.5 text-xs text-neutral-400">
                      Invoice No.:{" "}
                      {selectedCalculation.invoiceNo}
                    </p>
                  </div>

                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                    2 Pages
                  </span>
                </div>

                {isPreviewLoading ? (
                  <div className="flex min-h-[850px] items-center justify-center bg-neutral-700">
                    <div className="text-center">
                      <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-white/30 border-t-white" />

                      <p className="mt-4 font-semibold text-white">
                        Clear PDF preview load ho
                        raha hai...
                      </p>
                    </div>
                  </div>
                ) : previewError ? (
                  <div className="flex min-h-[500px] items-center justify-center bg-white p-8">
                    <div className="max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                      <p className="font-bold text-red-800">
                        PDF Preview Error
                      </p>

                      <p className="mt-2 text-sm leading-6 text-red-700">
                        {previewError}
                      </p>
                    </div>
                  </div>
                ) : previewUrl ? (
                  <iframe
                    key={previewUrl}
                    src={`${previewUrl}#page=1&zoom=page-width&toolbar=0&navpanes=0`}
                    title={`Comparative Quotation ${selectedCalculation.invoiceNo}`}
                    className="h-[calc(100vh-190px)] min-h-[900px] w-full bg-neutral-700"
                    style={{
                      border: "none",
                      display: "block",
                    }}
                  />
                ) : (
                  <div className="flex min-h-[500px] items-center justify-center bg-white text-sm font-semibold text-gray-500">
                    PDF preview available nahi hai.
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}