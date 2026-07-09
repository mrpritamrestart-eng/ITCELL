"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

export default function CurrentStockPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchStock = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/stationery/stock");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Stock data load nahi ho paya");
      }

      setStockItems(data.stock);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Stock data load nahi ho paya"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  const filteredItems = useMemo(() => {
    return stockItems.filter((item) =>
      item.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [stockItems, searchText]);

  const totalItems = stockItems.length;

  const lowStockItems = stockItems.filter(
    (item) => item.status === "Low Stock"
  ).length;

  const outOfStockItems = stockItems.filter(
    (item) => item.status === "Out of Stock"
  ).length;

  const sufficientStockItems = stockItems.filter(
    (item) => item.status === "Available"
  ).length;

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/stationery-bills"
              className="mb-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Back to Stationery Bills
            </Link>

            <h1 className="text-3xl font-bold text-gray-900">Current Stock</h1>

            <p className="mt-2 text-gray-600">
              Purchase entry se stock automatic add hoga aur out entry se stock
              automatic minus hoga.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchStock}
            disabled={isLoading}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isLoading ? "Loading..." : "Refresh Stock"}
          </button>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
            {errorMessage}
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">Total Items</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {totalItems}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Sufficient Stock
            </p>
            <p className="mt-2 text-3xl font-bold text-green-700">
              {sufficientStockItems}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">Low Stock</p>
            <p className="mt-2 text-3xl font-bold text-orange-600">
              {lowStockItems}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">Out of Stock</p>
            <p className="mt-2 text-3xl font-bold text-red-600">
              {outOfStockItems}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Stock Register
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Database se actual item-wise stock.
              </p>
            </div>

            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search item..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-80"
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[1050px] border-collapse bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Sr.
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Stationery Item
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Purchase In
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Branch Out
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Available Stock
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Unit
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Minimum Required
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Need to Order
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-sm font-semibold text-gray-500"
                    >
                      Stock data loading...
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  filteredItems.map((item, index) => {
                    let statusClass =
                      "bg-green-50 text-green-700 border-green-200";

                    if (item.status === "Out of Stock") {
                      statusClass = "bg-red-50 text-red-700 border-red-200";
                    } else if (item.status === "Low Stock") {
                      statusClass =
                        "bg-orange-50 text-orange-700 border-orange-200";
                    }

                    return (
                      <tr key={item._id} className="hover:bg-gray-50">
                        <td className="border-b px-4 py-4 text-sm font-semibold text-gray-700">
                          {index + 1}
                        </td>

                        <td className="border-b px-4 py-4 text-sm font-bold text-gray-900">
                          {item.name}
                        </td>

                        <td className="border-b px-4 py-4 text-sm font-bold text-green-700">
                          {item.totalIn}
                        </td>

                        <td className="border-b px-4 py-4 text-sm font-bold text-red-600">
                          {item.totalOut}
                        </td>

                        <td className="border-b px-4 py-4 text-sm font-bold text-blue-700">
                          {item.availableQuantity}
                        </td>

                        <td className="border-b px-4 py-4 text-sm text-gray-700">
                          {item.unit}
                        </td>

                        <td className="border-b px-4 py-4 text-sm text-gray-700">
                          {item.minimumRequired}
                        </td>

                        <td className="border-b px-4 py-4 text-sm font-bold text-gray-900">
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
                      className="px-4 py-10 text-center text-sm font-semibold text-gray-500"
                    >
                      No stock item found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-medium text-blue-900">
            Formula: Current Stock = Purchase In - Branch Out
          </div>
        </div>
      </div>
    </main>
  );
}