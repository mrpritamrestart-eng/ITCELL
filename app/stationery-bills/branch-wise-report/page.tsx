"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Branch = { _id: string; name: string; code: string };
type UnitTotal = { unit: string; total: number };
type ItemSummary = { itemId: string; itemName: string; unit: string; quantity: number };
type BranchDetail = { branchId: string; branchName: string; branchCode?: string; items: ItemSummary[]; unitTotals: UnitTotal[] };

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function Totals({ values }: { values: UnitTotal[] }) {
  if (!values.length) return <span className="text-gray-400">No issue</span>;
  return <div className="flex flex-wrap gap-2">{values.map((entry) => <span key={entry.unit} className="rounded-full bg-blue-100 px-3 py-1 text-sm font-black text-blue-800">{entry.total} {entry.unit}</span>)}</div>;
}

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export default function BranchWiseMonthlyReportPage() {
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [summary, setSummary] = useState<ItemSummary[]>([]);
  const [details, setDetails] = useState<BranchDetail[]>([]);
  const [unitTotals, setUnitTotals] = useState<UnitTotal[]>([]);
  const [period, setPeriod] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/stationery/reports/branch-wise?month=${month}&branchIds=${selected.join(",")}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Branch-wise report load nahi ho payi");
      setBranches(data.branches || []);
      setSummary(data.combinedSummary || []);
      setDetails(data.branchWiseDetails || []);
      setUnitTotals(data.unitTotals || []);
      setPeriod(data.period || { start: "", end: "" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Report load nahi ho payi"); }
    finally { setLoading(false); }
  }, [month, selected]);

  useEffect(() => { void load(); }, [load]);

  const filteredBranches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return branches.filter((branch) => `${branch.name} ${branch.code}`.toLowerCase().includes(query));
  }, [branches, search]);

  function toggle(id: string) { setSelected((old) => old.includes(id) ? old.filter((entry) => entry !== id) : [...old, id]); }
  function selectVisible() { setSelected((old) => [...new Set([...old, ...filteredBranches.map((branch) => branch._id)])]); }

  function exportCsv() {
    const lines: unknown[][] = [["Month", month], ["Period", `${period.start} to ${period.end}`], [], ["Combined Item", "Quantity", "Unit"]];
    summary.forEach((item) => lines.push([item.itemName, item.quantity, item.unit]));
    details.forEach((detail) => {
      lines.push([], [detail.branchName, detail.branchCode || ""], ["Item", "Quantity", "Unit"]);
      detail.items.forEach((item) => lines.push([item.itemName, item.quantity, item.unit]));
    });
    const csv = lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `branch-wise-stationery-${month}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><Link href="/stationery-bills" className="text-sm font-bold text-blue-700">← Back to Stationery Bills</Link><h1 className="mt-2 text-3xl font-black">Branch-wise Monthly Data</h1><p className="mt-2 text-gray-600">एक या multiple branches का actual item-wise issue record.</p></div><div className="rounded-2xl bg-white p-4 shadow-sm"><div className="mb-2 text-xs font-bold uppercase text-gray-500">Selected total</div><Totals values={unitTotals}/></div></div>
    {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div>}
    <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
      <aside className="rounded-2xl bg-white p-5 shadow-sm">
        <label className="text-sm font-bold">Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3"/></label>
        <div className="my-4 rounded-xl bg-blue-50 p-3 text-sm"><b>Period:</b> {period.start || "—"} to {period.end || "—"}</div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search branch/code" className="mb-3 w-full rounded-xl border px-4 py-3"/>
        <div className="mb-3 flex gap-2"><button onClick={selectVisible} className="flex-1 rounded-xl bg-blue-600 px-3 py-2 font-bold text-white">Select Visible</button><button onClick={() => setSelected([])} className="flex-1 rounded-xl border px-3 py-2 font-bold">Clear</button></div>
        <div className="max-h-[520px] overflow-y-auto rounded-xl border">{filteredBranches.map((branch) => <label key={branch._id} className="flex cursor-pointer gap-3 border-b p-3 hover:bg-gray-50"><input type="checkbox" checked={selected.includes(branch._id)} onChange={() => toggle(branch._id)}/><span className="text-sm font-semibold">{branch.name}<span className="block text-xs text-gray-500">{branch.code}</span></span></label>)}{!filteredBranches.length && <div className="p-8 text-center text-sm text-gray-500">No branch found.</div>}</div>
        <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm font-bold">Selected: {selected.length}</div>
      </aside>
      <div className="space-y-6">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Combined Item Summary</h2><p className="text-sm text-gray-500">Selected branches combined.</p></div><div className="flex gap-2"><button onClick={exportCsv} disabled={!details.length} className="rounded-xl border border-green-600 px-4 py-2 font-bold text-green-700 disabled:opacity-40">CSV</button><button onClick={() => window.print()} className="rounded-xl border px-4 py-2 font-bold">Print</button><button onClick={() => void load()} disabled={loading} className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-40">{loading ? "Loading..." : "Refresh"}</button></div></div>
          <div className="overflow-x-auto rounded-xl border"><table className="w-full"><thead className="bg-gray-50"><tr><th className="p-3 text-left">Sr.</th><th className="p-3 text-left">Item</th><th className="p-3 text-right">Quantity</th><th className="p-3 text-left">Unit</th></tr></thead><tbody>{summary.map((item,index)=><tr key={item.itemId} className="border-t"><td className="p-3">{index+1}</td><td className="p-3 font-bold">{item.itemName}</td><td className="p-3 text-right font-black text-blue-700">{item.quantity}</td><td className="p-3">{item.unit}</td></tr>)}{!loading && !summary.length && <tr><td colSpan={4} className="p-10 text-center text-gray-500">Branches select करें या selected month में data उपलब्ध नहीं है।</td></tr>}</tbody></table></div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 p-4"><b>Unit-wise Total</b><Totals values={unitTotals}/></div>
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-black">Branch-wise Breakup</h2><div className="space-y-4">{details.map((detail)=><article key={detail.branchId} className="rounded-xl border"><header className="flex flex-wrap items-center justify-between gap-3 border-b bg-gray-50 p-4"><div><h3 className="font-black">{detail.branchName}</h3>{detail.branchCode && <p className="text-xs text-gray-500">{detail.branchCode}</p>}</div><Totals values={detail.unitTotals || []}/></header><div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{detail.items.map((item)=><div key={item.itemId} className="rounded-lg border bg-white p-3"><b>{item.itemName}</b><div className="mt-1 text-blue-700">{item.quantity} {item.unit}</div></div>)}</div></article>)}{!loading && !details.length && <div className="rounded-xl border border-dashed p-10 text-center text-gray-500">No branch selected.</div>}</div></section>
      </div>
    </div>
    <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-900">Box, Ream, Nos जैसे अलग units को एक single grand total में नहीं जोड़ा जाता।</p>
  </div></main>;
}
