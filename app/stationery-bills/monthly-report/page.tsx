"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type StationeryItem = {
  _id: string;
  name: string;
  unit: string;
};

type ReportRow = {
  branchId: string;
  branchName: string;
  itemQuantities: {
    itemId: string;
    itemName: string;
    unit: string;
    quantity: number;
  }[];
  total: number;
};

function getCurrentMonthValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export default function MonthlyBranchReportPage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [branchSearch, setBranchSearch] = useState("");

  const [stationeryItems, setStationeryItems] = useState<StationeryItem[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchMonthlyReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch(
        `/api/stationery/reports/monthly?month=${selectedMonth}`
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Monthly report load nahi ho payi");
      }

      setStationeryItems(data.stationeryItems || []);
      setRows(data.rows || []);
      setPeriodStart(data.period?.start || "");
      setPeriodEnd(data.period?.end || "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Monthly report load nahi ho payi"
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    void fetchMonthlyReport();
  }, [fetchMonthlyReport]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) =>
      row.branchName.toLowerCase().includes(branchSearch.toLowerCase())
    );
  }, [rows, branchSearch]);

  const filteredItemTotals = useMemo(() => {
    return stationeryItems.map((item) => {
      const total = filteredRows.reduce((sum, row) => {
        const foundItem = row.itemQuantities.find(
          (rowItem) => rowItem.itemId === item._id
        );

        return sum + (foundItem?.quantity || 0);
      }, 0);

      return {
        itemId: item._id,
        itemName: item.name,
        total,
      };
    });
  }, [filteredRows, stationeryItems]);

  const filteredGrandTotal = filteredItemTotals.reduce((sum, item) => {
    return sum + item.total;
  }, 0);

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/stationery-bills"
              className="mb-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Back to Stationery Bills
            </Link>

            <h1 className="text-3xl font-bold text-gray-900">
              Monthly Branch Report
            </h1>

            <p className="mt-2 text-gray-600">
              Database se month-wise PS/Branch rows aur stationery items columns
              wali table.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-6 py-4 text-right shadow-sm">
            <p className="text-sm font-medium text-gray-500">Grand Total</p>
            <p className="text-2xl font-bold text-blue-700">
              {filteredGrandTotal}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
            {errorMessage}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-5 rounded-2xl bg-white p-6 shadow-sm md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-700">
              Select Month
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-700">
              Search PS/Branch
            </label>
            <input
              type="text"
              value={branchSearch}
              onChange={(event) => setBranchSearch(event.target.value)}
              placeholder="Search branch..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-bold text-blue-900">Report Period</p>
            <p className="mt-1 text-sm font-semibold text-blue-800">
              {periodStart} to {periodEnd}
            </p>
            <p className="mt-1 text-xs font-medium text-blue-700">
              Data hamesha month ki 1st date se last date tak hoga.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-bold text-gray-700">Report Status</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {isLoading ? "Loading..." : "Ready"}
            </p>
            <p className="mt-1 text-xs font-medium text-gray-600">
              Branches: {filteredRows.length} | Items: {stationeryItems.length}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Monthly Stationery Out Table
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Actual out entries se branch-wise total issued stationery
                quantity.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchMonthlyReport}
              disabled={isLoading}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isLoading ? "Loading..." : "Refresh Report"}
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[2600px] border-collapse bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-20 border-b border-r bg-gray-50 px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Sr.
                  </th>

                  <th className="sticky left-[58px] z-20 min-w-[180px] border-b border-r bg-gray-50 px-4 py-4 text-left text-sm font-bold text-gray-700">
                    PS/Branch
                  </th>

                  {stationeryItems.map((item) => (
                    <th
                      key={item._id}
                      className="min-w-[120px] border-b border-r px-3 py-4 text-center text-xs font-bold text-gray-700"
                    >
                      {item.name}
                    </th>
                  ))}

                  <th className="min-w-[120px] border-b bg-gray-100 px-4 py-4 text-center text-sm font-bold text-gray-900">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      colSpan={stationeryItems.length + 3}
                      className="px-4 py-10 text-center text-sm font-semibold text-gray-500"
                    >
                      Monthly report loading...
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  filteredRows.map((row, rowIndex) => (
                    <tr key={row.branchId} className="hover:bg-gray-50">
                      <td className="sticky left-0 z-10 border-b border-r bg-white px-4 py-3 text-sm font-semibold text-gray-700">
                        {rowIndex + 1}
                      </td>

                      <td className="sticky left-[58px] z-10 border-b border-r bg-white px-4 py-3 text-sm font-bold text-gray-900">
                        {row.branchName}
                      </td>

                      {stationeryItems.map((item) => {
                        const foundItem = row.itemQuantities.find(
                          (rowItem) => rowItem.itemId === item._id
                        );

                        const quantity = foundItem?.quantity || 0;

                        return (
                          <td
                            key={`${row.branchId}-${item._id}`}
                            className="border-b border-r px-3 py-3 text-center text-sm font-semibold text-gray-700"
                          >
                            {quantity > 0 ? quantity : "-"}
                          </td>
                        );
                      })}

                      <td className="border-b bg-gray-50 px-4 py-3 text-center text-sm font-bold text-blue-700">
                        {row.total}
                      </td>
                    </tr>
                  ))}

                {!isLoading && filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={stationeryItems.length + 3}
                      className="px-4 py-10 text-center text-sm font-semibold text-gray-500"
                    >
                      No branch data found.
                    </td>
                  </tr>
                )}
              </tbody>

              {!isLoading && filteredRows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100">
                    <td
                      colSpan={2}
                      className="sticky left-0 z-20 border-r bg-gray-100 px-4 py-4 text-right text-sm font-bold text-gray-900"
                    >
                      Item Total
                    </td>

                    {filteredItemTotals.map((item) => (
                      <td
                        key={item.itemId}
                        className="border-r px-3 py-4 text-center text-sm font-bold text-gray-900"
                      >
                        {item.total > 0 ? item.total : "-"}
                      </td>
                    ))}

                    <td className="px-4 py-4 text-center text-base font-bold text-green-700">
                      {filteredGrandTotal}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-medium text-blue-900">
            Report source: Stationery Out Entry database records.
          </div>
        </div>
      </div>
    </main>
  );
}