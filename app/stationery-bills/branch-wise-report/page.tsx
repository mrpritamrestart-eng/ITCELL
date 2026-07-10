"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Branch = {
  _id: string;
  name: string;
  code: string;
};

type CombinedSummaryItem = {
  itemId: string;
  itemName: string;
  unit: string;
  quantity: number;
};

type BranchWiseDetail = {
  branchId: string;
  branchName: string;
  items: CombinedSummaryItem[];
  totalQuantity: number;
};

function getCurrentMonthValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export default function BranchWiseMonthlyReportPage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [branchSearch, setBranchSearch] = useState("");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [combinedSummary, setCombinedSummary] = useState<CombinedSummaryItem[]>(
    []
  );
  const [branchWiseDetails, setBranchWiseDetails] = useState<
    BranchWiseDetail[]
  >([]);

  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const [grandTotalQuantity, setGrandTotalQuantity] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchBranchWiseReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const branchIds = selectedBranches.join(",");

      const response = await fetch(
        `/api/stationery/reports/branch-wise?month=${selectedMonth}&branchIds=${branchIds}`
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Branch-wise report load nahi ho payi");
      }

      setBranches(data.branches || []);
      setCombinedSummary(data.combinedSummary || []);
      setBranchWiseDetails(data.branchWiseDetails || []);
      setGrandTotalQuantity(data.grandTotalQuantity || 0);
      setPeriodStart(data.period?.start || "");
      setPeriodEnd(data.period?.end || "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Branch-wise report load nahi ho payi"
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedBranches]);

  useEffect(() => {
    void fetchBranchWiseReport();
  }, [fetchBranchWiseReport]);

  const filteredBranches = useMemo(() => {
    return branches.filter((branch) =>
      branch.name.toLowerCase().includes(branchSearch.toLowerCase())
    );
  }, [branches, branchSearch]);

  const toggleBranch = (branchId: string) => {
    setSelectedBranches((previousBranches) => {
      if (previousBranches.includes(branchId)) {
        return previousBranches.filter((id) => id !== branchId);
      }

      return [...previousBranches, branchId];
    });
  };

  const selectAllFilteredBranches = () => {
    setSelectedBranches((previousBranches) => {
      const filteredIds = filteredBranches.map((branch) => branch._id);

      const newBranchIds = filteredIds.filter(
        (id) => !previousBranches.includes(id)
      );

      return [...previousBranches, ...newBranchIds];
    });
  };

  const clearSelectedBranches = () => {
    setSelectedBranches([]);
  };

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/stationery-bills"
              className="mb-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Back to Stationery Bills
            </Link>

            <h1 className="text-3xl font-bold text-gray-900">
              Branch-wise Monthly Data
            </h1>

            <p className="mt-2 text-gray-600">
              Database se ek ya multiple PS/Branches ka selected month ka
              stationery out data.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-6 py-4 text-right shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Total Issued Quantity
            </p>
            <p className="text-2xl font-bold text-blue-700">
              {grandTotalQuantity}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
            {errorMessage}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-5">
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

            <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-bold text-blue-900">Report Period</p>
              <p className="mt-1 text-sm font-semibold text-blue-800">
                {periodStart} to {periodEnd}
              </p>
              <p className="mt-1 text-xs font-medium text-blue-700">
                Data month ki 1st date se last date tak hi hoga.
              </p>
            </div>

            <div className="mb-4">
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

            <div className="mb-4 flex gap-3">
              <button
                type="button"
                onClick={selectAllFilteredBranches}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
              >
                Select All
              </button>

              <button
                type="button"
                onClick={clearSelectedBranches}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>

            <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-gray-200">
              {filteredBranches.map((branch) => (
                <label
                  key={branch._id}
                  className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedBranches.includes(branch._id)}
                    onChange={() => toggleBranch(branch._id)}
                    className="h-4 w-4"
                  />

                  <span className="text-sm font-semibold text-gray-800">
                    {branch.name}
                  </span>
                </label>
              ))}

              {filteredBranches.length === 0 && (
                <div className="px-4 py-8 text-center text-sm font-semibold text-gray-500">
                  No branch found.
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm font-semibold text-gray-700">
              Selected Branches: {selectedBranches.length}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Combined Item Summary
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Selected branches ka combined item-wise monthly data.
                  </p>
                </div>

                <div className="text-sm font-bold text-blue-700">
                  {isLoading ? "Loading..." : `Total: ${grandTotalQuantity}`}
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full min-w-[700px] border-collapse bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                        Sr.
                      </th>
                      <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                        Stationery Item
                      </th>
                      <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                        Quantity
                      </th>
                      <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                        Unit
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {isLoading && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-10 text-center text-sm font-semibold text-gray-500"
                        >
                          Report loading...
                        </td>
                      </tr>
                    )}

                    {!isLoading &&
                      combinedSummary.map((item, index) => (
                        <tr key={item.itemId} className="hover:bg-gray-50">
                          <td className="border-b px-4 py-3 text-sm font-semibold text-gray-700">
                            {index + 1}
                          </td>

                          <td className="border-b px-4 py-3 text-sm font-bold text-gray-900">
                            {item.itemName}
                          </td>

                          <td className="border-b px-4 py-3 text-sm font-bold text-blue-700">
                            {item.quantity}
                          </td>

                          <td className="border-b px-4 py-3 text-sm text-gray-700">
                            {item.unit}
                          </td>
                        </tr>
                      ))}

                    {!isLoading && combinedSummary.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-10 text-center text-sm font-semibold text-gray-500"
                        >
                          Please select one or more PS/Branches, ya selected
                          month me data available nahi hai.
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {!isLoading && combinedSummary.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50">
                        <td
                          colSpan={2}
                          className="px-4 py-4 text-right text-base font-bold text-gray-900"
                        >
                          Grand Total
                        </td>

                        <td className="px-4 py-4 text-base font-bold text-green-700">
                          {grandTotalQuantity}
                        </td>

                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Branch-wise Breakup
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Har selected PS/Branch ka alag-alag item-wise actual data.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={fetchBranchWiseReport}
                  disabled={isLoading}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {isLoading ? "Loading..." : "Refresh Report"}
                </button>
              </div>

              <div className="space-y-5">
                {branchWiseDetails.map((branchData) => (
                  <div
                    key={branchData.branchId}
                    className="rounded-2xl border border-gray-200"
                  >
                    <div className="flex flex-col gap-2 border-b bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-lg font-bold text-gray-900">
                        {branchData.branchName}
                      </h3>

                      <p className="text-sm font-bold text-blue-700">
                        Total Quantity: {branchData.totalQuantity}
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[650px] border-collapse">
                        <thead>
                          <tr>
                            <th className="border-b px-4 py-3 text-left text-sm font-bold text-gray-700">
                              Sr.
                            </th>
                            <th className="border-b px-4 py-3 text-left text-sm font-bold text-gray-700">
                              Stationery Item
                            </th>
                            <th className="border-b px-4 py-3 text-left text-sm font-bold text-gray-700">
                              Quantity
                            </th>
                            <th className="border-b px-4 py-3 text-left text-sm font-bold text-gray-700">
                              Unit
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {branchData.items.map((item, index) => (
                            <tr key={item.itemId} className="hover:bg-gray-50">
                              <td className="border-b px-4 py-3 text-sm font-semibold text-gray-700">
                                {index + 1}
                              </td>

                              <td className="border-b px-4 py-3 text-sm font-bold text-gray-900">
                                {item.itemName}
                              </td>

                              <td className="border-b px-4 py-3 text-sm font-bold text-blue-700">
                                {item.quantity}
                              </td>

                              <td className="border-b px-4 py-3 text-sm text-gray-700">
                                {item.unit}
                              </td>
                            </tr>
                          ))}

                          {branchData.items.length === 0 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-8 text-center text-sm font-semibold text-gray-500"
                              >
                                Is branch ka selected month me koi data nahi
                                hai.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {!isLoading && branchWiseDetails.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-12 text-center text-sm font-semibold text-gray-500">
                    Branch-wise breakup dekhne ke liye left side se PS/Branch
                    select karo.
                  </div>
                )}

                {isLoading && (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-12 text-center text-sm font-semibold text-gray-500">
                    Report loading...
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-medium text-blue-900">
                Report source: Stationery Out Entry database records.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}