"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";

type PurchaseItem = { itemName: string; quantity: number; unit: string; rate: number; total: number };
type PurchaseEntry = {
  _id: string;
  purchaseNo?: string;
  purchaseDate: string;
  shopName: string;
  invoiceNumber?: string;
  items: PurchaseItem[];
  grandTotal: number;
  remarks?: string;
  status?: "ACTIVE" | "VOID";
  voidReason?: string;
};

export default function PurchaseRegisterPage() {
  const [entries, setEntries] = useState<PurchaseEntry[]>([]);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ status, search, limit: "100" });
      const response = await fetch(`/api/stationery/purchases?${params}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Purchase register load nahi hua");
      setEntries(data.entries || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Purchase register load nahi hua");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { void load(); }, [load]);

  async function voidEntry(entry: PurchaseEntry) {
    const reason = window.prompt("Purchase entry cancel karne ka reason likhein:");
    if (!reason) return;
    const response = await fetch("/api/stationery/purchases", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry._id, action: "void", reason }),
    });
    const data = await response.json();
    setMessage(data.message || "");
    if (response.ok && data.success) await load();
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/stationery-bills" className="text-sm font-bold text-blue-700">← Back to Stationery Bills</Link>
            <h1 className="mt-2 text-3xl font-black text-gray-900">Purchase Register</h1>
            <p className="mt-2 text-gray-600">Saved purchases, item details aur safe cancellation with stock reversal.</p>
          </div>
          <Link href="/stationery-bills/purchase-entry" className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white">+ New Purchase</Link>
        </div>

        <div className="mb-5 grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_180px_auto]">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Purchase no, firm or invoice search" className="rounded-xl border border-gray-300 px-4 py-3" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-gray-300 px-4 py-3">
            <option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="VOID">Cancelled</option>
          </select>
          <button onClick={() => void load()} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">Refresh</button>
        </div>

        {message && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 font-semibold text-blue-900">{message}</div>}
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-gray-900 text-white"><tr><th className="px-4 py-3 text-left">Purchase No.</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Firm</th><th className="px-4 py-3 text-left">Invoice</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Action</th></tr></thead>
            <tbody>
              {entries.map((entry) => (
                <Fragment key={entry._id}>
                  <tr key={entry._id} className="border-b border-gray-200">
                    <td className="px-4 py-3 font-bold">{entry.purchaseNo || entry._id.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3">{new Date(entry.purchaseDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3">{entry.shopName}</td>
                    <td className="px-4 py-3">{entry.invoiceNumber || "—"}</td>
                    <td className="px-4 py-3 text-right font-bold">₹ {Number(entry.grandTotal).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center"><span className={`rounded-full px-3 py-1 text-xs font-black ${entry.status === "VOID" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{entry.status || "ACTIVE"}</span></td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setExpanded(expanded === entry._id ? null : entry._id)} className="mr-2 rounded-lg border px-3 py-2 text-sm font-bold">{expanded === entry._id ? "Hide" : "View"}</button>
                      {entry.status !== "VOID" && <button onClick={() => void voidEntry(entry)} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white">Cancel</button>}
                    </td>
                  </tr>
                  {expanded === entry._id && <tr key={`${entry._id}-details`}><td colSpan={7} className="bg-gray-50 p-4"><div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="p-2 text-left">Item</th><th className="p-2 text-right">Qty</th><th className="p-2 text-left">Unit</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Total</th></tr></thead><tbody>{entry.items.map((item, index) => <tr key={`${item.itemName}-${index}`} className="border-t"><td className="p-2">{item.itemName}</td><td className="p-2 text-right">{item.quantity}</td><td className="p-2">{item.unit}</td><td className="p-2 text-right">₹ {item.rate.toFixed(2)}</td><td className="p-2 text-right">₹ {item.total.toFixed(2)}</td></tr>)}</tbody></table></div>{entry.remarks && <p className="mt-3 text-sm"><b>Remarks:</b> {entry.remarks}</p>}{entry.voidReason && <p className="mt-2 text-sm text-red-700"><b>Cancellation:</b> {entry.voidReason}</p>}</td></tr>}
                </Fragment>
              ))}
              {!loading && entries.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-gray-500">No purchase entries found.</td></tr>}
              {loading && <tr><td colSpan={7} className="p-10 text-center">Loading...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
