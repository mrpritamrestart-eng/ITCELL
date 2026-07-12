"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OpeningStockItem = {
  itemId: string;
  itemName: string;
  unit: string;
  minimumRequired: number;
  quantity: number;
};

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function AdminOpeningStockPage() {
  const [items, setItems] = useState<OpeningStockItem[]>([]);
  const [searchText, setSearchText] = useState("");
  const [stockDate, setStockDate] = useState(formatDate(new Date()));
  const [remarks, setRemarks] = useState("Opening stock entry");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState("");

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fetchOpeningStock = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/stationery/opening-stock");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Opening stock load nahi ho paya");
      }

      setItems(data.items || []);
      setIsLocked(Boolean(data.locked));
      setLockReason(String(data.lockReason || ""));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Opening stock load nahi ho paya"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOpeningStock();
  }, []);

  const filteredItems = useMemo(() => {
    const search = searchText.toLowerCase();

    return items.filter(
      (item) =>
        item.itemName.toLowerCase().includes(search) ||
        item.unit.toLowerCase().includes(search)
    );
  }, [items, searchText]);

  const updateQuantity = (itemId: string, value: string) => {
    const quantity = Number(value) || 0;

    setItems((previousItems) =>
      previousItems.map((item) =>
        item.itemId === itemId
          ? {
              ...item,
              quantity,
            }
          : item
      )
    );
  };

  const totalOpeningQuantity = items.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0);
  }, 0);

  const saveOpeningStock = async () => {
    if (isLocked) {
      setErrorMessage(lockReason || "Opening Stock locked hai. Stock Adjustment use karein.");
      return;
    }
    const confirmed = window.confirm(
      "Opening stock save karna hai? Agar pehle se opening stock saved hai to wahi update ho jayega, duplicate entry nahi banegi."
    );

    if (!confirmed) return;

    try {
      setIsSaving(true);
      setSuccessMessage("");
      setErrorMessage("");

      if (!stockDate) {
        throw new Error("Opening stock date required hai");
      }

      const response = await fetch("/api/stationery/opening-stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stockDate,
          remarks,
          items: items.map((item) => ({
            itemId: item.itemId,
            quantity: Number(item.quantity) || 0,
          })),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Opening stock save nahi ho paya");
      }

      setSuccessMessage("Opening stock successfully save ho gaya");
      await fetchOpeningStock();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Opening stock save nahi ho paya"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/admin"
              className="mb-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Back to Admin Panel
            </Link>

            <h1 className="text-3xl font-bold text-gray-900">
              Opening Stock Entry
            </h1>

            <p className="mt-2 text-gray-600">
              Already available stationery stock ko first time system me add
              karne ke liye.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-6 py-4 text-right shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Total Opening Quantity
            </p>
            <p className="text-2xl font-bold text-blue-700">
              {totalOpeningQuantity}
            </p>
          </div>
        </div>

        {isLocked && (
          <div className="mb-6 rounded-2xl border border-orange-300 bg-orange-50 px-5 py-4 text-sm font-bold text-orange-900">
            Opening Stock Locked: {lockReason} <Link href="/stationery-bills/stock-adjustment" className="underline">Open Stock Adjustment</Link>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-bold text-green-800">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
            {errorMessage}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-5 rounded-2xl bg-white p-6 shadow-sm md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-700">
              Opening Stock Date
            </label>

            <input
              type="date"
              value={stockDate}
              onChange={(event) => setStockDate(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-700">
              Search Item
            </label>

            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search stationery item..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-700">
              Remarks
            </label>

            <input
              type="text"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Remarks"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Item-wise Opening Stock
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Quantity enter karo. Blank/0 ka matlab item stock me available
                nahi hai.
              </p>
            </div>

            <button
              type="button"
              onClick={saveOpeningStock}
              disabled={isLoading || isSaving || isLocked}
              className="rounded-xl bg-green-600 px-6 py-3 font-bold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSaving ? "Saving..." : "Save Opening Stock"}
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[900px] border-collapse bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Sr.
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Stationery Item
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Unit
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Minimum Stock
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Opening Quantity
                  </th>
                </tr>
              </thead>

              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm font-semibold text-gray-500"
                    >
                      Opening stock loading...
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  filteredItems.map((item, index) => (
                    <tr key={item.itemId} className="hover:bg-gray-50">
                      <td className="border-b px-4 py-4 text-sm font-semibold text-gray-700">
                        {index + 1}
                      </td>

                      <td className="border-b px-4 py-4 text-sm font-bold text-gray-900">
                        {item.itemName}
                      </td>

                      <td className="border-b px-4 py-4 text-sm font-semibold text-gray-700">
                        {item.unit}
                      </td>

                      <td className="border-b px-4 py-4 text-sm font-bold text-blue-700">
                        {item.minimumRequired}
                      </td>

                      <td className="border-b px-4 py-4">
                        <input
                          type="number"
                          min="0"
                          disabled={isLocked}
                          value={item.quantity}
                          onChange={(event) =>
                            updateQuantity(item.itemId, event.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500"
                        />
                      </td>
                    </tr>
                  ))}

                {!isLoading && filteredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm font-semibold text-gray-500"
                    >
                      No stationery item found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-xl bg-yellow-50 p-4 text-sm font-medium text-yellow-900">
            Important: Ye page sirf first time available stock add karne ke liye
            hai. Baad me shop se saman aane par Purchase Entry se stock
            automatic add hoga. Agar yahan dobara save karoge to opening stock
            update hoga, duplicate add nahi hoga.
          </div>
        </div>
      </div>
    </main>
  );
}