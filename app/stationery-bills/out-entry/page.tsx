"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Branch = {
  _id: string;
  name: string;
  code: string;
};

type StationeryItem = {
  _id: string;
  name: string;
  unit: string;
};

type OutItem = {
  id: number;
  itemId: string;
  quantity: string;
};

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function StationeryOutEntryPage() {
  const today = new Date();

  const currentMonthStart = formatDate(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const currentMonthEnd = formatDate(
    new Date(today.getFullYear(), today.getMonth() + 1, 0)
  );

  const [branches, setBranches] = useState<Branch[]>([]);
  const [stationeryItems, setStationeryItems] = useState<StationeryItem[]>([]);

  const [branchId, setBranchId] = useState("");
  const [issueDate, setIssueDate] = useState(formatDate(today));
  const [receiverName, setReceiverName] = useState("");
  const [remarks, setRemarks] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [items, setItems] = useState<OutItem[]>([
    {
      id: 1,
      itemId: "",
      quantity: "",
    },
  ]);

  useEffect(() => {
    async function loadMasterData() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const [branchesResponse, itemsResponse] = await Promise.all([
          fetch("/api/stationery/branches"),
          fetch("/api/stationery/items"),
        ]);

        const branchesData = await branchesResponse.json();
        const itemsData = await itemsResponse.json();

        if (!branchesData.success) {
          throw new Error(branchesData.message || "Branches load nahi ho payi");
        }

        if (!itemsData.success) {
          throw new Error(itemsData.message || "Items load nahi ho paye");
        }

        setBranches(branchesData.branches);
        setStationeryItems(itemsData.items);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Master data load nahi hua"
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadMasterData();
  }, []);

  const isDateValid =
    issueDate >= currentMonthStart && issueDate <= currentMonthEnd;

  const totalQuantity = useMemo(() => {
    return items.reduce((total, item) => {
      return total + (Number(item.quantity) || 0);
    }, 0);
  }, [items]);

  const getSelectedItem = (itemId: string) => {
    return stationeryItems.find((item) => item._id === itemId);
  };

  const updateItem = (id: number, field: keyof OutItem, value: string) => {
    setItems((previousItems) =>
      previousItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const addItemRow = () => {
    setItems((previousItems) => [
      ...previousItems,
      {
        id: Date.now(),
        itemId: "",
        quantity: "",
      },
    ]);
  };

  const removeItemRow = (id: number) => {
    if (items.length === 1) return;

    setItems((previousItems) =>
      previousItems.filter((item) => item.id !== id)
    );
  };

  const resetForm = () => {
    setBranchId("");
    setIssueDate(formatDate(today));
    setReceiverName("");
    setRemarks("");
    setSuccessMessage("");
    setErrorMessage("");
    setItems([
      {
        id: 1,
        itemId: "",
        quantity: "",
      },
    ]);
  };

  const saveOutEntry = async () => {
    try {
      setIsSaving(true);
      setSuccessMessage("");
      setErrorMessage("");

      if (!branchId) {
        throw new Error("PS/Branch select karo");
      }

      if (!issueDate) {
        throw new Error("Out Date required hai");
      }

      if (!isDateValid) {
        throw new Error("Out Entry sirf present month me allowed hai");
      }

      const validItems = items.filter(
        (item) => item.itemId && Number(item.quantity) > 0
      );

      if (validItems.length === 0) {
        throw new Error("Kam se kam ek valid item add karo");
      }

      const response = await fetch("/api/stationery/out-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchId,
          issueDate,
          receiverName,
          remarks,
          items: validItems.map((item) => ({
            itemId: item.itemId,
            quantity: Number(item.quantity),
          })),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Out entry save nahi ho payi");
      }

      setSuccessMessage("Stationery out entry successfully save ho gayi");
      setBranchId("");
      setIssueDate(formatDate(today));
      setReceiverName("");
      setRemarks("");
      setItems([
        {
          id: 1,
          itemId: "",
          quantity: "",
        },
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Out entry save nahi ho payi"
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
              Stationery Out Entry
            </h1>

            <p className="mt-2 text-gray-600">
              PS/Branch ko diye gaye stationery items ki database entry.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-6 py-4 text-right shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Quantity</p>
            <p className="text-2xl font-bold text-blue-700">{totalQuantity}</p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
          <p className="font-semibold text-yellow-900">
            Important Rule: Stationery Out Entry sirf present month me ho sakti
            hai.
          </p>
          <p className="mt-1 text-sm text-yellow-800">
            Current month range: {currentMonthStart} to {currentMonthEnd}
          </p>
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
          <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                PS/Branch
              </label>
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                disabled={isLoading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              >
                <option value="">
                  {isLoading ? "Loading branches..." : "Select PS/Branch"}
                </option>

                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Out Date
              </label>
              <input
                type="date"
                value={issueDate}
                min={currentMonthStart}
                max={currentMonthEnd}
                onChange={(event) => setIssueDate(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              {!isDateValid && (
                <p className="mt-2 text-sm font-semibold text-red-600">
                  Previous/next month ki entry allowed nahi hai.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Receiver Name
              </label>
              <input
                type="text"
                value={receiverName}
                onChange={(event) => setReceiverName(event.target.value)}
                placeholder="Receiver name"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Entry Type
              </label>
              <input
                type="text"
                value="Stationery Out"
                readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-700 outline-none"
              />
            </div>
          </div>

          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Issued Items
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Branch ko diye gaye items ki details.
              </p>
            </div>

            <button
              type="button"
              onClick={addItemRow}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
            >
              + Add Item
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[850px] border-collapse bg-white">
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
                  <th className="border-b px-4 py-4 text-center text-sm font-bold text-gray-700">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => {
                  const selectedItem = getSelectedItem(item.itemId);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="border-b px-4 py-3 text-sm font-semibold text-gray-700">
                        {index + 1}
                      </td>

                      <td className="border-b px-4 py-3">
                        <select
                          value={item.itemId}
                          onChange={(event) =>
                            updateItem(item.id, "itemId", event.target.value)
                          }
                          disabled={isLoading}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 disabled:bg-gray-100"
                        >
                          <option value="">
                            {isLoading ? "Loading items..." : "Select item"}
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
                          min="0"
                          onChange={(event) =>
                            updateItem(item.id, "quantity", event.target.value)
                          }
                          placeholder="0"
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
                    colSpan={2}
                    className="px-4 py-4 text-right text-lg font-bold text-gray-900"
                  >
                    Total Quantity
                  </td>
                  <td className="px-4 py-4 text-lg font-bold text-blue-700">
                    {totalQuantity}
                  </td>
                  <td colSpan={2}></td>
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
              onChange={(event) => setRemarks(event.target.value)}
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
              onClick={saveOutEntry}
              disabled={isSaving || isLoading || !branchId || !isDateValid}
              className="rounded-xl bg-green-600 px-6 py-3 font-bold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSaving ? "Saving..." : "Save Out Entry"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}