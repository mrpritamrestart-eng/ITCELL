"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";

type OutItem = { itemName: string; quantity: number; unit: string };
type OutEntry = { _id: string; issueNo?: string; issueDate: string; branchName: string; branchCode?: string; receiverName?: string; items: OutItem[]; remarks?: string; status?: "ACTIVE" | "VOID"; voidReason?: string };

export default function OutRegisterPage() {
  const [entries, setEntries] = useState<OutEntry[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month, status, limit: "100" });
      const response = await fetch(`/api/stationery/out-entries?${params}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Out register load nahi hua");
      setEntries(data.entries || []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Out register load nahi hua"); }
    finally { setLoading(false); }
  }, [month, status]);

  useEffect(() => { void load(); }, [load]);

  async function cancel(entry: OutEntry) {
    const reason = window.prompt("Out entry cancel karne ka reason likhein:");
    if (!reason) return;
    const response = await fetch("/api/stationery/out-entries", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entry._id, action: "void", reason }) });
    const data = await response.json();
    setMessage(data.message || "");
    if (response.ok && data.success) await load();
  }

  return <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><Link href="/stationery-bills" className="text-sm font-bold text-blue-700">← Back to Stationery Bills</Link><h1 className="mt-2 text-3xl font-black">Stationery Out Register</h1><p className="mt-2 text-gray-600">Branch issue history aur safe cancellation with automatic stock restoration.</p></div><Link href="/stationery-bills/out-entry" className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">+ New Out Entry</Link></div>
    <div className="mb-5 flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-sm"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-xl border px-4 py-3"/><select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border px-4 py-3"><option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="VOID">Cancelled</option></select><button onClick={() => void load()} className="rounded-xl bg-gray-900 px-5 py-3 font-bold text-white">Refresh</button></div>
    {message && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 font-semibold text-blue-900">{message}</div>}
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm"><table className="w-full min-w-[950px]"><thead className="bg-gray-900 text-white"><tr><th className="p-3 text-left">Issue No.</th><th className="p-3 text-left">Date</th><th className="p-3 text-left">Branch</th><th className="p-3 text-left">Receiver</th><th className="p-3 text-center">Items</th><th className="p-3 text-center">Status</th><th className="p-3 text-center">Action</th></tr></thead><tbody>
      {entries.map((entry) => <Fragment key={entry._id}><tr className="border-b"><td className="p-3 font-bold">{entry.issueNo || entry._id.slice(-8).toUpperCase()}</td><td className="p-3">{new Date(entry.issueDate).toLocaleDateString("en-IN")}</td><td className="p-3">{entry.branchName}{entry.branchCode ? ` (${entry.branchCode})` : ""}</td><td className="p-3">{entry.receiverName || "—"}</td><td className="p-3 text-center">{entry.items.length}</td><td className="p-3 text-center"><span className={`rounded-full px-3 py-1 text-xs font-black ${entry.status === "VOID" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{entry.status || "ACTIVE"}</span></td><td className="p-3 text-center"><button onClick={() => setExpanded(expanded === entry._id ? null : entry._id)} className="mr-2 rounded-lg border px-3 py-2 text-sm font-bold">{expanded === entry._id ? "Hide" : "View"}</button>{entry.status !== "VOID" && <button onClick={() => void cancel(entry)} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white">Cancel</button>}</td></tr>{expanded === entry._id && <tr key={`${entry._id}-d`}><td colSpan={7} className="bg-gray-50 p-4"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{entry.items.map((item, index) => <div key={`${item.itemName}-${index}`} className="rounded-lg border bg-white p-3"><b>{item.itemName}</b><div>{item.quantity} {item.unit}</div></div>)}</div>{entry.remarks && <p className="mt-3"><b>Remarks:</b> {entry.remarks}</p>}{entry.voidReason && <p className="mt-2 text-red-700"><b>Cancellation:</b> {entry.voidReason}</p>}</td></tr>}</Fragment>)}
      {loading && <tr><td colSpan={7} className="p-10 text-center">Loading...</td></tr>}{!loading && entries.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-gray-500">No entries found.</td></tr>}
    </tbody></table></div>
  </div></main>;
}
