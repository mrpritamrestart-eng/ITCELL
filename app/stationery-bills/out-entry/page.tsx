"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { QuantityTileSelectorModal, SingleSelectTileModal } from "@/components/stationery/TileSelectionModals";

type Branch = { _id: string; name: string; code: string; sortOrder?: number };
type StationeryItem = { _id: string; name: string; unit: string; sortOrder?: number };
type OutItem = { id: string; itemId: string; quantity: string };

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rowId(itemId: string) {
  return `out-${itemId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function StationeryOutEntryPage() {
  const today = useMemo(() => new Date(), []);
  const currentMonthStart = useMemo(() => formatDate(new Date(today.getFullYear(), today.getMonth(), 1)), [today]);
  const currentMonthEnd = useMemo(() => formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)), [today]);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [stationeryItems, setStationeryItems] = useState<StationeryItem[]>([]);
  const [branchTileColumns, setBranchTileColumns] = useState(6);
  const [itemTileColumns, setItemTileColumns] = useState(6);
  const [branchId, setBranchId] = useState("");
  const [issueDate, setIssueDate] = useState(formatDate(today));
  const [receiverName, setReceiverName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<OutItem[]>([]);
  const [branchSelectorOpen, setBranchSelectorOpen] = useState(false);
  const [itemSelectorOpen, setItemSelectorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadMasterData() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const [branchesResponse, itemsResponse, settingsResponse] = await Promise.all([
          fetch("/api/stationery/branches"),
          fetch("/api/stationery/items"),
          fetch("/api/admin/selector-settings"),
        ]);
        const [branchesData, itemsData, settingsData] = await Promise.all([
          branchesResponse.json(),
          itemsResponse.json(),
          settingsResponse.json(),
        ]);
        if (!branchesResponse.ok || !branchesData.success) throw new Error(branchesData.message || "Branches load nahi ho payi");
        if (!itemsResponse.ok || !itemsData.success) throw new Error(itemsData.message || "Items load nahi ho paye");
        setBranches(branchesData.branches || []);
        setStationeryItems(itemsData.items || []);
        if (settingsData.success) {
          setBranchTileColumns(settingsData.settings?.branchTileColumns || 6);
          setItemTileColumns(settingsData.settings?.itemTileColumns || 6);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Master data load nahi hua");
      } finally {
        setIsLoading(false);
      }
    }

    void loadMasterData();
  }, []);

  const isDateValid = issueDate >= currentMonthStart && issueDate <= currentMonthEnd;
  const totalQuantity = useMemo(() => items.reduce((total, item) => total + (Number(item.quantity) || 0), 0), [items]);
  const selectedBranch = branches.find((branch) => branch._id === branchId);
  const popupQuantities = useMemo(
    () => Object.fromEntries(items.filter((item) => Number(item.quantity) > 0).map((item) => [item.itemId, Number(item.quantity)])),
    [items]
  );

  function updateItem(id: string, value: string) {
    setItems((previousItems) => previousItems.map((item) => (item.id === id ? { ...item, quantity: value } : item)));
  }

  function applyItemSelection(quantities: Record<string, number>) {
    setItems((current) => {
      const existing = new Map(current.map((row) => [row.itemId, row]));
      return stationeryItems
        .filter((item) => Number(quantities[item._id]) > 0)
        .map((item) => ({
          id: existing.get(item._id)?.id || rowId(item._id),
          itemId: item._id,
          quantity: String(quantities[item._id]),
        }));
    });
  }

  function removeItemRow(id: string) {
    setItems((previousItems) => previousItems.filter((item) => item.id !== id));
  }

  function resetForm(clearMessages = true) {
    setBranchId("");
    setIssueDate(formatDate(today));
    setReceiverName("");
    setRemarks("");
    setItems([]);
    if (clearMessages) {
      setSuccessMessage("");
      setErrorMessage("");
    }
  }

  async function saveOutEntry() {
    try {
      setIsSaving(true);
      setSuccessMessage("");
      setErrorMessage("");
      if (!branchId) throw new Error("Popup se PS/Branch select karo");
      if (!issueDate) throw new Error("Out Date required hai");
      if (!isDateValid) throw new Error("Out Entry sirf present month me allowed hai");
      const validItems = items.filter((item) => item.itemId && Number(item.quantity) > 0);
      if (!validItems.length) throw new Error("Popup se kam se kam ek valid item select karo");

      const response = await fetch("/api/stationery/out-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          issueDate,
          receiverName,
          remarks,
          items: validItems.map((item) => ({ itemId: item.itemId, quantity: Number(item.quantity) })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Out entry save nahi ho payi");
      resetForm(false);
      setSuccessMessage(data.message || "Stationery out entry successfully save ho gayi");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Out entry save nahi ho payi");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/stationery-bills" className="mb-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800">
              ← Back to Stationery Bills
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Stationery Out Entry</h1>
            <p className="mt-2 text-gray-600">Branch aur items popup se select karein; verify karne ke baad final entry save hogi.</p>
          </div>
          <div className="rounded-2xl bg-white px-6 py-4 text-right shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Quantity</p>
            <p className="text-2xl font-bold text-blue-700">{totalQuantity}</p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
          <p className="font-semibold text-yellow-900">Important Rule: Stationery Out Entry sirf present month me ho sakti hai.</p>
          <p className="mt-1 text-sm text-yellow-800">Current month range: {currentMonthStart} to {currentMonthEnd}</p>
        </div>

        {successMessage ? <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-bold text-green-800">{successMessage}</div> : null}
        {errorMessage ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">{errorMessage}</div> : null}

        <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">PS/Branch</label>
              <button
                type="button"
                onClick={() => setBranchSelectorOpen(true)}
                disabled={isLoading}
                className={`w-full rounded-xl border px-4 py-3 text-left font-bold outline-none ${selectedBranch ? "border-blue-400 bg-blue-50 text-blue-900" : "border-gray-300 bg-white text-gray-600"}`}
              >
                {selectedBranch ? (
                  <span>
                    {selectedBranch.name}
                    <span className="ml-2 text-xs text-blue-600">({selectedBranch.code})</span>
                  </span>
                ) : isLoading ? (
                  "Loading branches..."
                ) : (
                  "Select PS/Branch from Popup"
                )}
              </button>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">Out Date</label>
              <input
                type="date"
                value={issueDate}
                min={currentMonthStart}
                max={currentMonthEnd}
                onChange={(event) => setIssueDate(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              {!isDateValid ? <p className="mt-2 text-sm font-semibold text-red-600">Previous/next month ki entry allowed nahi hai.</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">Receiver Name</label>
              <input
                type="text"
                value={receiverName}
                onChange={(event) => setReceiverName(event.target.value)}
                placeholder="Receiver name"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">Entry Type</label>
              <input type="text" value="Stationery Out" readOnly className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-700 outline-none" />
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Issued Items</h2>
              <p className="mt-1 text-sm text-gray-500">Popup ke Apply button se sirf form update hoga; database save final button se hoga.</p>
            </div>
            <button
              type="button"
              onClick={() => setItemSelectorOpen(true)}
              disabled={isLoading}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {items.length ? `Edit Selected Items (${items.length})` : "+ Select Items & Quantity"}
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[750px] border-collapse bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">Sr.</th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">Stationery Item</th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">Quantity</th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">Unit</th>
                  <th className="border-b px-4 py-4 text-center text-sm font-bold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const selectedItem = stationeryItems.find((entry) => entry._id === item.itemId);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="border-b px-4 py-3 text-sm font-semibold text-gray-700">{index + 1}</td>
                      <td className="border-b px-4 py-3 text-sm font-bold text-gray-900">{selectedItem?.name || "Unknown item"}</td>
                      <td className="border-b px-4 py-3">
                        <input
                          type="number"
                          value={item.quantity}
                          min="0"
                          step="any"
                          onChange={(event) => updateItem(item.id, event.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="border-b px-4 py-3 font-semibold text-gray-700">{selectedItem?.unit || "—"}</td>
                      <td className="border-b px-4 py-3 text-center">
                        <button type="button" onClick={() => removeItemRow(item.id)} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-100">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!items.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center font-semibold text-gray-500">
                      No item selected. Popup button open karein.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={2} className="px-4 py-4 text-right text-lg font-bold text-gray-900">Total Quantity</td>
                  <td className="px-4 py-4 text-lg font-bold text-blue-700">{totalQuantity}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-bold text-gray-700">Remarks</label>
            <textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Any additional note"
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => resetForm()} className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-bold text-gray-700 hover:bg-gray-50">
              Reset
            </button>
            <button
              type="button"
              onClick={() => void saveOutEntry()}
              disabled={isSaving || isLoading || !branchId || !isDateValid}
              className="rounded-xl bg-green-600 px-6 py-3 font-bold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSaving ? "Saving..." : "Final Save Out Entry"}
            </button>
          </div>
        </div>
      </div>

      <SingleSelectTileModal
        open={branchSelectorOpen}
        title="Select One PS/Branch"
        subtitle="Is page par ek time me sirf ek PS/Branch select ho sakta hai."
        options={branches.map((branch) => ({ id: branch._id, label: branch.name, secondary: branch.code }))}
        value={branchId}
        columns={branchTileColumns}
        onClose={() => setBranchSelectorOpen(false)}
        onApply={setBranchId}
      />

      <QuantityTileSelectorModal
        open={itemSelectorOpen}
        title="Select Issued Items & Quantity"
        subtitle="Tile click = quantity 1. Minus se quantity 0 hote hi item deselect ho jayega."
        options={stationeryItems.map((item) => ({ id: item._id, label: item.name, secondary: item.unit }))}
        quantities={popupQuantities}
        columns={itemTileColumns}
        onClose={() => setItemSelectorOpen(false)}
        onApply={applyItemSelection}
      />
    </main>
  );
}
