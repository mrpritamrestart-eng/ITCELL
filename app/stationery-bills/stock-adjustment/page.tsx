"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Item = { _id: string; name: string; unit: string };
type Entry = { _id: string; adjustmentNo: string; adjustmentDate: string; itemName: string; unit: string; adjustmentType: "INCREASE" | "DECREASE"; quantity: number; reason: string; status: "ACTIVE" | "VOID"; voidReason?: string };

export default function StockAdjustmentPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [itemId, setItemId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<"INCREASE" | "DECREASE">("INCREASE");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [itemsResponse, entriesResponse] = await Promise.all([fetch("/api/stationery/items"), fetch("/api/stationery/stock-adjustments")]);
    const itemsData = await itemsResponse.json(); const entriesData = await entriesResponse.json();
    if (itemsData.success) setItems(itemsData.items || []);
    if (entriesData.success) setEntries(entriesData.entries || []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/stationery/stock-adjustments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, adjustmentDate: date, adjustmentType: type, quantity: Number(quantity), reason }) });
      const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || "Save failed");
      setMessage(data.message); setQuantity(""); setReason(""); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function cancel(entry: Entry) {
    const cancelReason = window.prompt("Adjustment cancel reason:"); if (!cancelReason) return;
    const response = await fetch("/api/stationery/stock-adjustments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entry._id, action: "void", reason: cancelReason }) });
    const data = await response.json(); setMessage(data.message || ""); if (response.ok && data.success) await load();
  }

  const selected = items.find((item) => item._id === itemId);
  return <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl"><Link href="/stationery-bills" className="text-sm font-bold text-blue-700">← Back to Stationery Bills</Link><h1 className="mt-2 text-3xl font-black">Stock Adjustment</h1><p className="mt-2 text-gray-600">Opening stock के बाद correction, damage, return या physical verification difference यहाँ दर्ज करें।</p>
    <div className="my-6 rounded-2xl bg-white p-6 shadow-sm"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border px-4 py-3"/><select value={itemId} onChange={(e) => setItemId(e.target.value)} className="rounded-xl border px-4 py-3"><option value="">Select item</option>{items.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select><select value={type} onChange={(e) => setType(e.target.value as "INCREASE" | "DECREASE")} className="rounded-xl border px-4 py-3"><option value="INCREASE">Increase Stock</option><option value="DECREASE">Decrease Stock</option></select><input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={`Quantity ${selected ? `(${selected.unit})` : ""}`} className="rounded-xl border px-4 py-3"/><button disabled={saving} onClick={() => void save()} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save Adjustment"}</button></div><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Mandatory reason: physical verification, damaged stock, return, correction etc." className="mt-4 w-full rounded-xl border px-4 py-3"/></div>
    {message && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 font-semibold text-blue-900">{message}</div>}
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm"><table className="w-full min-w-[900px]"><thead className="bg-gray-900 text-white"><tr><th className="p-3 text-left">No.</th><th className="p-3 text-left">Date</th><th className="p-3 text-left">Item</th><th className="p-3 text-left">Type</th><th className="p-3 text-right">Quantity</th><th className="p-3 text-left">Reason</th><th className="p-3 text-center">Status</th><th className="p-3 text-center">Action</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry._id} className="border-b"><td className="p-3 font-bold">{entry.adjustmentNo}</td><td className="p-3">{new Date(entry.adjustmentDate).toLocaleDateString("en-IN")}</td><td className="p-3">{entry.itemName}</td><td className={`p-3 font-bold ${entry.adjustmentType === "INCREASE" ? "text-green-700" : "text-red-700"}`}>{entry.adjustmentType}</td><td className="p-3 text-right">{entry.quantity} {entry.unit}</td><td className="p-3">{entry.reason}{entry.voidReason ? <div className="text-xs text-red-700">Cancelled: {entry.voidReason}</div> : null}</td><td className="p-3 text-center">{entry.status}</td><td className="p-3 text-center">{entry.status === "ACTIVE" && <button onClick={() => void cancel(entry)} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white">Cancel</button>}</td></tr>)}</tbody></table></div>
  </div></main>;
}
