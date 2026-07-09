"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StationeryItem = {
  _id: string;
  name: string;
  unit: string;
  minimumRequired: number;
};

type PurchaseItem = {
  id: number;
  itemId: string;
  quantity: string;
  rate: string;
};

export default function StationeryPurchaseEntryPage() {
  const [purchaseDate, setPurchaseDate] = useState("");
  const [shopName, setShopName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  const [stationeryItems, setStationeryItems] = useState<StationeryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [items, setItems] = useState<PurchaseItem[]>([
    {
      id: 1,
      itemId: "",
      quantity: "",
      rate: "",
    },
  ]);

  useEffect(() => {
    async function fetchStationeryItems() {
      try {
        setItemsLoading(true);

        const response = await fetch("/api/stationery/items");
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "Failed to fetch items");
        }

        setStationeryItems(data.items);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Stationery items load nahi ho paye"
        );
      } finally {
        setItemsLoading(false);
      }
    }

    fetchStationeryItems();
  }, []);

  const getSelectedItem = (itemId: string) => {
    return stationeryItems.find((item) => item._id === itemId);
  };

  const updateItem = (
    id: number,
    field: keyof PurchaseItem,
    value: string
  ) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const addItemRow = () => {
    setItems((prevItems) => [
      ...prevItems,
      {
        id: Date.now(),
        itemId: "",
        quantity: "",
        rate: "",
      },
    ]);
  };

  const removeItemRow = (id: number) => {
    if (items.length === 1) return;
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const grandTotal = useMemo(() => {
    return items.reduce((total, item) => {
      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      return total + quantity * rate;
    }, 0);
  }, [items]);

  const resetForm = () => {
    setPurchaseDate("");
    setShopName("");
    setInvoiceNumber("");
    setRemarks("");
    setSuccessMessage("");
    setErrorMessage("");
    setItems([
      {
        id: 1,
        itemId: "",
        quantity: "",
        rate: "",
      },
    ]);
  };

  const savePurchaseEntry = async () => {
    try {
      setIsSaving(true);
      setSuccessMessage("");
      setErrorMessage("");

      if (!purchaseDate) {
        throw new Error("Purchase Date required hai");
      }

      if (!shopName.trim()) {
        throw new Error("Shop / Firm Name required hai");
      }

      const validItems = items.filter(
        (item) => item.itemId && Number(item.quantity) > 0
      );

      if (validItems.length === 0) {
        throw new Error("Kam se kam ek valid item add karo");
      }

      const response = await fetch("/api/stationery/purchases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          purchaseDate,
          shopName,
          invoiceNumber,
          remarks,
          items: validItems.map((item) => ({
            itemId: item.itemId,
            quantity: Number(item.quantity),
            rate: Number(item.rate) || 0,
          })),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Purchase entry save nahi ho payi");
      }

      setSuccessMessage("Purchase entry successfully save ho gayi");
      setPurchaseDate("");
      setShopName("");
      setInvoiceNumber("");
      setRemarks("");
      setItems([
        {
          id: 1,
          itemId: "",
          quantity: "",
          rate: "",
        },
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Purchase entry save nahi ho payi"
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
              href="/stationery-bills"
              className="mb-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Back to Stationery Bills
            </Link>

            <h1 className="text-3xl font-bold text-gray-900">
              Stationery Purchase Entry
            </h1>

            <p className="mt-2 text-gray-600">
              Shop se bulk me liye gaye stationery items ki purchase entry.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-6 py-4 text-right shadow-sm">
            <p className="text-sm font-medium text-gray-500">Grand Total</p>
            <p className="text-2xl font-bold text-green-700">
              ₹ {grandTotal.toFixed(2)}
            </p>
          </div>
        </div>

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

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Purchase Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Shop / Firm Name
              </label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Enter shop name"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Bill / Invoice No.
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Enter bill number"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Purchase Items
            </h2>

            <button
              type="button"
              onClick={addItemRow}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
            >
              + Add Item
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[950px] border-collapse bg-white">
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
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Rate
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Total
                  </th>
                  <th className="border-b px-4 py-4 text-center text-sm font-bold text-gray-700">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => {
                  const selectedItem = getSelectedItem(item.itemId);
                  const quantity = Number(item.quantity) || 0;
                  const rate = Number(item.rate) || 0;
                  const total = quantity * rate;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="border-b px-4 py-3 text-sm font-semibold text-gray-700">
                        {index + 1}
                      </td>

                      <td className="border-b px-4 py-3">
                        <select
                          value={item.itemId}
                          onChange={(e) =>
                            updateItem(item.id, "itemId", e.target.value)
                          }
                          disabled={itemsLoading}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 disabled:bg-gray-100"
                        >
                          <option value="">
                            {itemsLoading ? "Loading items..." : "Select item"}
                          </option>

                          {stationeryItems.map((stationeryItem) => (
                            <option
                              key={stationeryItem._id}
                              value={stationeryItem._id}
                            >
                              {stationeryItem.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="border-b px-4 py-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, "quantity", e.target.value)
                          }
                          placeholder="0"
                          min="0"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500"
                        />
                      </td>

                      <td className="border-b px-4 py-3">
                        <input
                          type="text"
                          value={selectedItem?.unit || ""}
                          readOnly
                          placeholder="Unit"
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-semibold text-gray-700 outline-none"
                        />
                      </td>

                      <td className="border-b px-4 py-3">
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) =>
                            updateItem(item.id, "rate", e.target.value)
                          }
                          placeholder="0"
                          min="0"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500"
                        />
                      </td>

                      <td className="border-b px-4 py-3 text-sm font-bold text-gray-900">
                        ₹ {total.toFixed(2)}
                      </td>

                      <td className="border-b px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(item.id)}
                          disabled={items.length === 1}
                          className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-gray-50">
                  <td
                    colSpan={5}
                    className="px-4 py-4 text-right text-lg font-bold text-gray-900"
                  >
                    Grand Total
                  </td>
                  <td className="px-4 py-4 text-lg font-bold text-green-700">
                    ₹ {grandTotal.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-bold text-gray-700">
              Remarks
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any additional note"
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-bold text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={savePurchaseEntry}
              disabled={isSaving || itemsLoading}
              className="rounded-xl bg-green-600 px-6 py-3 font-bold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSaving ? "Saving..." : "Save Purchase Entry"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}