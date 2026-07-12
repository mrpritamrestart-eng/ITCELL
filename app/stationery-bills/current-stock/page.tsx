"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StockItem = {
  _id: string;
  name: string;
  unit: string;
  minimumRequired: number;
  totalIn: number;
  totalOut: number;
  availableQuantity: number;
  needToOrder: number;
  status: "Available" | "Low Stock" | "Out of Stock";
};

type ReconciliationBatch = {
  _id: string;
  batchNo: string;
  reconciliationDate: string;
  reason: string;
  sourceFileName?: string;
  totalRows: number;
  changedRows: number;
  unchangedRows: number;
  createdBy: string;
  createdAt: string;
};

type ReconciliationSummary = {
  totalRows: number;
  changedRows: number;
  unchangedRows: number;
  increasedItems?: number;
  decreasedItems?: number;
};

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function CurrentStockPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [batches, setBatches] = useState<ReconciliationBatch[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [reconciliationDate, setReconciliationDate] = useState(todayInIndia());
  const [reconciliationReason, setReconciliationReason] = useState(
    "Physical stock verification through CSV"
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadSummary, setUploadSummary] =
    useState<ReconciliationSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStock = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await fetch("/api/stationery/stock", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Stock data load nahi ho paya");
      }
      setStockItems(data.stock || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Stock data load nahi ho paya"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchReconciliations = useCallback(async () => {
    try {
      const response = await fetch("/api/stationery/stock-reconciliation", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok && data.success) setBatches(data.batches || []);
    } catch {
      // Stock page should remain usable even if history cannot be loaded.
    }
  }, []);

  useEffect(() => {
    void fetchStock();
    void fetchReconciliations();
  }, [fetchStock, fetchReconciliations]);

  const filteredItems = useMemo(
    () =>
      stockItems.filter((item) =>
        item.name.toLowerCase().includes(searchText.toLowerCase())
      ),
    [stockItems, searchText]
  );

  const lowStockItems = stockItems.filter(
    (item) => item.status === "Low Stock"
  ).length;
  const outOfStockItems = stockItems.filter(
    (item) => item.status === "Out of Stock"
  ).length;
  const sufficientStockItems = stockItems.filter(
    (item) => item.status === "Available"
  ).length;

  async function uploadActualStock() {
    setUploadError("");
    setUploadMessage("");
    setUploadSummary(null);

    if (!csvFile) {
      setUploadError("Pehle completed CSV file select karein");
      return;
    }
    if (!csvFile.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Only .csv file upload karein");
      return;
    }
    if (csvFile.size > 2_000_000) {
      setUploadError("CSV file 2 MB se badi nahi honi chahiye");
      return;
    }
    if (reconciliationReason.trim().length < 5) {
      setUploadError("Reconciliation reason kam se kam 5 characters ka rakhein");
      return;
    }

    const confirmed = window.confirm(
      "CSV me di gayi ACTUAL_STOCK_QUANTITY ko final physical stock maana jayega. System difference ki adjustment entries banayega. Continue karein?"
    );
    if (!confirmed) return;

    try {
      setIsUploading(true);
      const csvText = await csvFile.text();
      const response = await fetch("/api/stationery/stock-reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText,
          reconciliationDate,
          reason: reconciliationReason.trim(),
          fileName: csvFile.name,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "CSV stock adjustment save nahi hui");
      }

      setUploadMessage(data.message || "Actual stock successfully updated");
      setUploadSummary(data.summary || null);
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await Promise.all([fetchStock(), fetchReconciliations()]);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "CSV stock adjustment save nahi hui"
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/stationery-bills"
              className="mb-3 inline-block text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              ← Back to Stationery Bills
            </Link>
            <h1 className="text-3xl font-black text-gray-950">Current Stock</h1>
            <p className="mt-2 text-gray-700">
              Purchase, issue, manual adjustment aur physical verification ke
              according live available stock.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/stationery-bills/stock-ledger"
              className="rounded-xl border border-blue-600 bg-white px-5 py-3 text-sm font-bold text-blue-700"
            >
              Stock Ledger
            </Link>
            <Link
              href="/stationery-bills/stock-adjustment"
              className="rounded-xl border border-orange-600 bg-white px-5 py-3 text-sm font-bold text-orange-700"
            >
              Single Adjustment
            </Link>
            <button
              type="button"
              onClick={() => void fetchStock()}
              disabled={isLoading}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isLoading ? "Loading..." : "Refresh Stock"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
            {errorMessage}
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-600">Total Items</p>
            <p className="mt-2 text-3xl font-black text-gray-950">
              {stockItems.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-600">
              Sufficient Stock
            </p>
            <p className="mt-2 text-3xl font-black text-green-700">
              {sufficientStockItems}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-600">Low Stock</p>
            <p className="mt-2 text-3xl font-black text-orange-700">
              {lowStockItems}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-600">Out of Stock</p>
            <p className="mt-2 text-3xl font-black text-red-700">
              {outOfStockItems}
            </p>
          </div>
        </div>

        <section className="mb-8 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
          <div className="border-b border-blue-100 bg-blue-50 px-5 py-5 sm:px-6">
            <h2 className="text-xl font-black text-blue-950">
              CSV Actual Stock Reconciliation
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-900">
              Sample CSV download करें। उसमें केवल
              <b> actual_stock_quantity </b> और optional <b>remarks</b> बदलें,
              फिर वही file upload करें। Upload के बाद हर item का available
              stock CSV में दी गई actual physical quantity के बराबर हो जाएगा।
            </p>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.35fr] sm:p-6">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <h3 className="font-black text-gray-950">Step 1 — Sample File</h3>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                इसमें item ID, item name, unit और current system quantity पहले
                से भरी होगी। Rows, item details या current quantity को edit न
                करें।
              </p>
              <a
                href="/api/stationery/stock-reconciliation?download=sample"
                className="mt-5 inline-flex rounded-xl bg-green-700 px-5 py-3 text-sm font-bold text-white hover:bg-green-800"
              >
                Download Sample CSV
              </a>
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                Sample download होने के बाद purchase/out entry बदल जाए तो old
                CSV upload block हो जाएगी। ऐसी स्थिति में fresh sample download
                करें, ताकि नई entry गलती से overwrite न हो।
              </div>
            </div>

            <div>
              <h3 className="font-black text-gray-950">
                Step 2 — Completed CSV Upload
              </h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-bold text-gray-800">
                  Physical Verification Date
                  <input
                    type="date"
                    max={todayInIndia()}
                    value={reconciliationDate}
                    onChange={(event) =>
                      setReconciliationDate(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                  />
                </label>
                <label className="text-sm font-bold text-gray-800">
                  Completed CSV File
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) =>
                      setCsvFile(event.target.files?.[0] || null)
                    }
                    className="mt-2 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:font-bold file:text-blue-800"
                  />
                </label>
              </div>

              <label className="mt-4 block text-sm font-bold text-gray-800">
                Reason / Verification Note
                <input
                  value={reconciliationReason}
                  onChange={(event) =>
                    setReconciliationReason(event.target.value)
                  }
                  maxLength={300}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                  placeholder="Physical stock verification reason"
                />
              </label>

              {uploadError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
                  {uploadError}
                </div>
              )}
              {uploadMessage && (
                <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
                  <div>{uploadMessage}</div>
                  {uploadSummary && (
                    <div className="mt-2 font-semibold">
                      Total rows: {uploadSummary.totalRows} · Adjusted: {" "}
                      {uploadSummary.changedRows} · Unchanged: {" "}
                      {uploadSummary.unchangedRows}
                      {typeof uploadSummary.increasedItems === "number" && (
                        <>
                          {" "}· Increased: {uploadSummary.increasedItems} ·
                          Decreased: {uploadSummary.decreasedItems || 0}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold leading-5 text-gray-600">
                  Original purchase/out history delete नहीं होगी। Difference
                  Stock Ledger में RECONCILIATION IN/OUT के रूप में record होगा।
                </p>
                <button
                  type="button"
                  onClick={() => void uploadActualStock()}
                  disabled={isUploading || !csvFile}
                  className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isUploading ? "Validating & Updating..." : "Upload & Set Actual Stock"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {batches.length > 0 && (
          <section className="mb-8 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-xl font-black text-gray-950">
                Recent CSV Reconciliations
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Latest physical stock verification batches.
              </p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[850px] bg-white">
                <thead className="bg-gray-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Batch No.</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                    <th className="px-4 py-3 text-right">Items Checked</th>
                    <th className="px-4 py-3 text-right">Adjusted</th>
                    <th className="px-4 py-3 text-left">User</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.slice(0, 10).map((batch) => (
                    <tr key={batch._id} className="border-b text-gray-800">
                      <td className="px-4 py-3 font-bold text-blue-800">
                        {batch.batchNo}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(batch.reconciliationDate)}
                      </td>
                      <td className="px-4 py-3">{batch.reason}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {batch.totalRows}
                      </td>
                      <td className="px-4 py-3 text-right font-black">
                        {batch.changedRows}
                      </td>
                      <td className="px-4 py-3">{batch.createdBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-gray-950">
                Stock Register
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Database से actual item-wise current balance.
              </p>
            </div>
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search item..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-80"
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[1050px] border-collapse bg-white">
              <thead className="bg-gray-100 text-gray-800">
                <tr>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold">
                    Sr.
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold">
                    Stationery Item
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold">
                    Total Stock In
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold">
                    Total Stock Out
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold">
                    Available Stock
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold">
                    Unit
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold">
                    Minimum Required
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold">
                    Need to Order
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-sm font-semibold text-gray-600"
                    >
                      Stock data loading...
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  filteredItems.map((item, index) => {
                    let statusClass =
                      "border-green-200 bg-green-50 text-green-800";
                    if (item.status === "Out of Stock") {
                      statusClass = "border-red-200 bg-red-50 text-red-800";
                    } else if (item.status === "Low Stock") {
                      statusClass =
                        "border-orange-200 bg-orange-50 text-orange-800";
                    }

                    return (
                      <tr key={item._id} className="hover:bg-gray-50">
                        <td className="border-b px-4 py-4 text-sm font-semibold text-gray-700">
                          {index + 1}
                        </td>
                        <td className="border-b px-4 py-4 text-sm font-bold text-gray-950">
                          {item.name}
                        </td>
                        <td className="border-b px-4 py-4 text-sm font-bold text-green-700">
                          {item.totalIn}
                        </td>
                        <td className="border-b px-4 py-4 text-sm font-bold text-red-700">
                          {item.totalOut}
                        </td>
                        <td className="border-b px-4 py-4 text-sm font-black text-blue-800">
                          {item.availableQuantity}
                        </td>
                        <td className="border-b px-4 py-4 text-sm text-gray-800">
                          {item.unit}
                        </td>
                        <td className="border-b px-4 py-4 text-sm text-gray-800">
                          {item.minimumRequired}
                        </td>
                        <td className="border-b px-4 py-4 text-sm font-bold text-gray-950">
                          {item.needToOrder}
                        </td>
                        <td className="border-b px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass}`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                {!isLoading && filteredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-sm font-semibold text-gray-600"
                    >
                      No stock item found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-950">
            Formula: Current Stock = Opening + Purchase + Adjustment In +
            Reconciliation In − Branch Out − Adjustment Out − Reconciliation
            Out
          </div>
        </section>
      </div>
    </main>
  );
}
