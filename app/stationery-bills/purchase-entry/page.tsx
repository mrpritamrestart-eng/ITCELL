"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { QuantityTileSelectorModal } from "@/components/stationery/TileSelectionModals";

type Item = { _id: string; name: string; unit: string; sortOrder?: number };
type Firm = { _id: string; name: string };
type Row = { id: string; itemId: string; quantity: string; rate: string };

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function rowId(itemId: string) {
  return `purchase-${itemId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function PurchaseEntryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [itemTileColumns, setItemTileColumns] = useState(6);
  const [firmId, setFirmId] = useState("");
  const [customFirm, setCustomFirm] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [itemResponse, firmResponse, settingsResponse] = await Promise.all([
          fetch("/api/stationery/items"),
          fetch("/api/stationery/firms"),
          fetch("/api/admin/selector-settings"),
        ]);
        const [itemData, firmData, settingsData] = await Promise.all([
          itemResponse.json(),
          firmResponse.json(),
          settingsResponse.json(),
        ]);
        if (!itemResponse.ok || !itemData.success) throw new Error(itemData.message || "Items load nahi hue");
        setItems(itemData.items || []);
        if (firmData.success) setFirms(firmData.firms || []);
        if (settingsData.success) setItemTileColumns(settingsData.settings?.itemTileColumns || 6);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Data load nahi hua");
        setIsError(true);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const grandTotal = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.rate) || 0), 0),
    [rows]
  );

  const popupQuantities = useMemo(
    () => Object.fromEntries(rows.filter((row) => Number(row.quantity) > 0).map((row) => [row.itemId, Number(row.quantity)])),
    [rows]
  );

  function updateRow(id: string, field: "quantity" | "rate", value: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function applyItemSelection(quantities: Record<string, number>) {
    setRows((current) => {
      const existing = new Map(current.map((row) => [row.itemId, row]));
      return items
        .filter((item) => Number(quantities[item._id]) > 0)
        .map((item) => {
          const old = existing.get(item._id);
          return {
            id: old?.id || rowId(item._id),
            itemId: item._id,
            quantity: String(quantities[item._id]),
            rate: old?.rate || "",
          };
        });
    });
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function reset() {
    setFirmId("");
    setCustomFirm("");
    setPurchaseDate(today());
    setInvoiceNumber("");
    setRemarks("");
    setRows([]);
    setMessage("");
    setIsError(false);
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      const validRows = rows.filter((row) => row.itemId && Number(row.quantity) > 0);
      if (!purchaseDate) throw new Error("Purchase date required hai");
      if (!firmId && !customFirm.trim()) throw new Error("Firm select karein ya custom firm name likhein");
      if (!validRows.length) throw new Error("Popup se kam se kam ek valid item select karein");

      const response = await fetch("/api/stationery/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseDate,
          firmId,
          shopName: customFirm.trim(),
          invoiceNumber,
          remarks,
          items: validRows.map((row) => ({
            itemId: row.itemId,
            quantity: Number(row.quantity),
            rate: Number(row.rate) || 0,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Purchase save nahi hui");
      setMessage(data.message || "Purchase saved successfully");
      setFirmId("");
      setCustomFirm("");
      setPurchaseDate(today());
      setInvoiceNumber("");
      setRemarks("");
      setRows([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Purchase save nahi hui");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/stationery-bills" className="text-sm font-bold text-blue-700">
              ← Back to Stationery Bills
            </Link>
            <h1 className="mt-2 text-3xl font-black">New Purchase Entry</h1>
            <p className="mt-2 text-gray-600">Popup me items/quantity choose karein, phir table verify karke final purchase save karein.</p>
          </div>
          <div className="rounded-2xl bg-white px-6 py-4 text-right shadow-sm">
            <div className="text-sm text-gray-500">Grand Total</div>
            <div className="text-2xl font-black text-green-700">₹ {grandTotal.toFixed(2)}</div>
          </div>
        </div>

        {message ? (
          <div className={`mb-5 rounded-xl border p-4 font-semibold ${isError ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>
            {message}
          </div>
        ) : null}

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-bold">Purchase Date</label>
              <input type="date" max={today()} value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} className="w-full rounded-xl border px-4 py-3" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold">Firm from Master</label>
              <select
                value={firmId}
                onChange={(event) => {
                  setFirmId(event.target.value);
                  if (event.target.value) setCustomFirm("");
                }}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">Select firm / use custom</option>
                {firms.map((firm) => (
                  <option key={firm._id} value={firm._id}>
                    {firm.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold">Custom Firm Name</label>
              <input
                disabled={Boolean(firmId)}
                value={customFirm}
                onChange={(event) => setCustomFirm(event.target.value)}
                placeholder="Only when firm is not in master"
                className="w-full rounded-xl border px-4 py-3 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold">Invoice Number</label>
              <input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} className="w-full rounded-xl border px-4 py-3" placeholder="Optional but recommended" />
            </div>
          </div>

          <div className="my-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Purchase Items</h2>
              <p className="mt-1 text-sm text-gray-500">Popup selection database me save nahi hoti; final save neeche hoga.</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectorOpen(true)}
              disabled={loading}
              className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {rows.length ? `Edit Selected Items (${rows.length})` : "+ Select Items & Quantity"}
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Sr.</th>
                  <th className="p-3 text-left">Item</th>
                  <th className="p-3 text-right">Quantity</th>
                  <th className="p-3 text-left">Unit</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const item = items.find((entry) => entry._id === row.itemId);
                  const total = (Number(row.quantity) || 0) * (Number(row.rate) || 0);
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="p-3">{index + 1}</td>
                      <td className="p-3 font-bold">{item?.name || "Unknown item"}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.quantity}
                          onChange={(event) => updateRow(row.id, "quantity", event.target.value)}
                          className="w-full rounded-lg border px-3 py-2 text-right"
                        />
                      </td>
                      <td className="p-3 font-semibold">{item?.unit || "—"}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.rate}
                          onChange={(event) => updateRow(row.id, "rate", event.target.value)}
                          className="w-full rounded-lg border px-3 py-2 text-right"
                        />
                      </td>
                      <td className="p-3 text-right font-bold">₹ {total.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <button type="button" onClick={() => removeRow(row.id)} className="rounded-lg bg-red-50 px-3 py-2 font-bold text-red-700 hover:bg-red-100">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center font-semibold text-gray-500">
                      No items selected. “Select Items & Quantity” button open karein.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={3} placeholder="Remarks" className="mt-5 w-full rounded-xl border px-4 py-3" />
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={reset} className="rounded-xl border px-5 py-3 font-bold">
              Reset
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void save()}
              className="rounded-xl bg-green-600 px-6 py-3 font-bold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Final Save Purchase"}
            </button>
          </div>
        </div>
      </div>

      <QuantityTileSelectorModal
        open={selectorOpen}
        title="Select Purchase Items & Quantity"
        subtitle="Item tile click karte hi quantity 1 hogi. Minus se 0 karne par item deselect ho jayega."
        options={items.map((item) => ({ id: item._id, label: item.name, secondary: item.unit }))}
        quantities={popupQuantities}
        columns={itemTileColumns}
        onClose={() => setSelectorOpen(false)}
        onApply={applyItemSelection}
      />
    </main>
  );
}
