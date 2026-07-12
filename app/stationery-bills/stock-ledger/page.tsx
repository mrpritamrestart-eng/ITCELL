"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { _id: string; name: string; unit: string };
type LedgerRow = { _id: string; transactionDate: string; transactionType: string; quantityIn: number; quantityOut: number; branchName?: string; remarks?: string; runningBalance: number };

export default function StockLedgerPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [itemId, setItemId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/stationery/items").then((response) => response.json()).then((data) => {
      if (data.success) setItems(data.items || []);
      else setMessage(data.message || "Items load nahi hue");
    });
  }, []);

  async function loadLedger() {
    if (!itemId) { setMessage("Pehle stationery item select karein"); return; }
    setLoading(true); setMessage("");
    try {
      const params = new URLSearchParams({ itemId });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const response = await fetch(`/api/stationery/stock-ledger?${params}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Ledger load nahi hua");
      setRows(data.ledger || []); setOpeningBalance(data.openingBalance || 0); setClosingBalance(data.closingBalance || 0);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ledger load nahi hua"); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl">
    <Link href="/stationery-bills" className="text-sm font-bold text-blue-700">← Back to Stationery Bills</Link>
    <h1 className="mt-2 text-3xl font-black">Item-wise Stock Ledger</h1><p className="mt-2 text-gray-600">Opening, purchase, issue aur adjustment ki complete movement history.</p>
    <div className="my-6 grid gap-3 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-[1fr_180px_180px_auto]">
      <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="rounded-xl border px-4 py-3"><option value="">Select stationery item</option>{items.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.unit})</option>)}</select>
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border px-4 py-3" />
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border px-4 py-3" />
      <button onClick={() => void loadLedger()} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">{loading ? "Loading..." : "Load Ledger"}</button>
    </div>
    {message && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">{message}</div>}
    <div className="mb-5 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-white p-5 shadow-sm"><div className="text-sm text-gray-500">Opening Balance</div><div className="text-2xl font-black">{openingBalance}</div></div><div className="rounded-2xl bg-white p-5 shadow-sm"><div className="text-sm text-gray-500">Closing Balance</div><div className="text-2xl font-black text-blue-700">{closingBalance}</div></div></div>
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm"><table className="w-full min-w-[900px]"><thead className="bg-gray-900 text-white"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Branch/Reference</th><th className="p-3 text-right">In</th><th className="p-3 text-right">Out</th><th className="p-3 text-right">Balance</th><th className="p-3 text-left">Remarks</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id} className="border-b"><td className="p-3">{new Date(row.transactionDate).toLocaleDateString("en-IN")}</td><td className="p-3 font-bold">{row.transactionType.replaceAll("_", " ")}</td><td className="p-3">{row.branchName || "Office Stock"}</td><td className="p-3 text-right text-green-700">{row.quantityIn || "—"}</td><td className="p-3 text-right text-red-700">{row.quantityOut || "—"}</td><td className="p-3 text-right font-black">{row.runningBalance}</td><td className="p-3">{row.remarks || "—"}</td></tr>)}{rows.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-gray-500">Select item and load ledger.</td></tr>}</tbody></table></div>
  </div></main>;
}
