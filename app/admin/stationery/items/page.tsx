"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StationeryItem = {
  _id: string;
  name: string;
  unit: string;
  minimumRequired: number;
};

const unitOptions = [
  "Nos",
  "Bundle",
  "Box",
  "Pack",
  "Packet",
  "Ream",
  "Set",
  "Kg",
  "Meter",
  "Roll",
  "Dozen",
];

export default function AdminStationeryItemsPage() {
  const [items, setItems] = useState<StationeryItem[]>([]);

  const [itemName, setItemName] = useState("");
  const [unit, setUnit] = useState("Nos");
  const [minimumRequired, setMinimumRequired] = useState("");

  const [searchText, setSearchText] = useState("");

  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [editingUnit, setEditingUnit] = useState("");
  const [editingMinimumRequired, setEditingMinimumRequired] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fetchItems = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/stationery/items");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Stationery items load nahi ho paye");
      }

      setItems(data.items || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Stationery items load nahi ho paye"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filteredItems = useMemo(() => {
    const search = searchText.toLowerCase();

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(search) ||
        item.unit.toLowerCase().includes(search)
    );
  }, [items, searchText]);

  const addItem = async () => {
    try {
      setIsSaving(true);
      setSuccessMessage("");
      setErrorMessage("");

      if (!itemName.trim()) {
        throw new Error("Stationery item name enter karo");
      }

      if (!unit.trim()) {
        throw new Error("Unit select/enter karo");
      }

      const response = await fetch("/api/stationery/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: itemName,
          unit,
          minimumRequired: Number(minimumRequired) || 0,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Stationery item add nahi ho paya");
      }

      setSuccessMessage("Stationery item successfully add ho gaya");
      setItemName("");
      setUnit("Nos");
      setMinimumRequired("");

      await fetchItems();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Stationery item add nahi ho paya."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (item: StationeryItem) => {
    setEditingId(item._id);
    setEditingName(item.name);
    setEditingUnit(item.unit);
    setEditingMinimumRequired(String(item.minimumRequired || 0));
    setSuccessMessage("");
    setErrorMessage("");
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditingName("");
    setEditingUnit("");
    setEditingMinimumRequired("");
  };

  const updateItem = async () => {
    try {
      setIsSaving(true);
      setSuccessMessage("");
      setErrorMessage("");

      if (!editingName.trim()) {
        throw new Error("Stationery item name enter karo");
      }

      if (!editingUnit.trim()) {
        throw new Error("Unit select/enter karo");
      }

      const response = await fetch("/api/stationery/items", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingId,
          name: editingName,
          unit: editingUnit,
          minimumRequired: Number(editingMinimumRequired) || 0,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Stationery item update nahi ho paya");
      }

      setSuccessMessage("Stationery item successfully update ho gaya");
      setEditingId("");
      setEditingName("");
      setEditingUnit("");
      setEditingMinimumRequired("");

      await fetchItems();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Stationery item update nahi ho paya"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const removeItem = async (item: StationeryItem) => {
    const confirmed = window.confirm(
      `${item.name} ko list se remove karna hai? Old entries safe rahengi.`
    );

    if (!confirmed) return;

    try {
      setIsSaving(true);
      setSuccessMessage("");
      setErrorMessage("");

      const response = await fetch("/api/stationery/items", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: item._id,
          action: "delete",
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Stationery item remove nahi ho paya");
      }

      setSuccessMessage("Stationery item list se remove ho gaya");
      await fetchItems();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Stationery item remove nahi ho paya"
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
              Name of Stationery Items
            </h1>

            <p className="mt-2 text-gray-600">
              Yahan jo stationery item add hoga, wahi purchase/out entry ke
              dropdown me show hoga.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-6 py-4 text-right shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Items</p>
            <p className="text-2xl font-bold text-blue-700">{items.length}</p>
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

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-gray-900">
            Add New Stationery Item
          </h2>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px_220px_auto]">
            <input
              type="text"
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              placeholder="Enter stationery item name"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {unitOptions.map((unitName) => (
                <option key={unitName} value={unitName}>
                  {unitName}
                </option>
              ))}
            </select>

            <input
              type="number"
              value={minimumRequired}
              min="0"
              onChange={(event) => setMinimumRequired(event.target.value)}
              placeholder="Minimum stock"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <button
              type="button"
              onClick={addItem}
              disabled={isSaving}
              className="rounded-xl bg-green-600 px-6 py-3 font-bold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSaving ? "Saving..." : "Add Item"}
            </button>
          </div>

          <p className="mt-3 text-sm font-medium text-gray-500">
            Unit item ke saath save hoga. Minimum stock Current Stock page par
            Low Stock calculation ke liye use hoga.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Stationery Item List
              </h2>
              <p className="mt-1 text-sm text-gray-500">Active items only.</p>
            </div>

            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search item/unit..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-80"
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[1000px] border-collapse bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Sr.
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Stationery Item Name
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Unit
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Minimum Stock
                  </th>
                  <th className="border-b px-4 py-4 text-center text-sm font-bold text-gray-700">
                    Action
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
                      Stationery items loading...
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  filteredItems.map((item, index) => (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="border-b px-4 py-4 text-sm font-semibold text-gray-700">
                        {index + 1}
                      </td>

                      <td className="border-b px-4 py-4">
                        {editingId === item._id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(event) =>
                              setEditingName(event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-900">
                            {item.name}
                          </span>
                        )}
                      </td>

                      <td className="border-b px-4 py-4">
                        {editingId === item._id ? (
                          <select
                            value={editingUnit}
                            onChange={(event) =>
                              setEditingUnit(event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500"
                          >
                            {unitOptions.map((unitName) => (
                              <option key={unitName} value={unitName}>
                                {unitName}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm font-semibold text-gray-700">
                            {item.unit}
                          </span>
                        )}
                      </td>

                      <td className="border-b px-4 py-4">
                        {editingId === item._id ? (
                          <input
                            type="number"
                            value={editingMinimumRequired}
                            min="0"
                            onChange={(event) =>
                              setEditingMinimumRequired(event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-sm font-bold text-blue-700">
                            {item.minimumRequired || 0}
                          </span>
                        )}
                      </td>

                      <td className="border-b px-4 py-4 text-center">
                        {editingId === item._id ? (
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={updateItem}
                              disabled={isSaving}
                              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:bg-gray-300"
                            >
                              Save
                            </button>

                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => removeItem(item)}
                              className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-100"
                            >
                              Remove
                            </button>
                          </div>
                        )}
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

          <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-medium text-blue-900">
            Note: Remove karne se old purchase/out entries delete nahi hongi.
            Item sirf future dropdown/list se hide ho jayega.
          </div>
        </div>
      </div>
    </main>
  );
}