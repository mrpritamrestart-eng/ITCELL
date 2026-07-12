"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type UnitTotal = { unit: string; total: number };
type StationeryItem = { _id: string; name: string; unit: string };
type ReportRow = {
  branchId: string;
  branchName: string;
  branchCode?: string;
  itemQuantities: { itemId: string; itemName: string; unit: string; quantity: number }[];
  unitTotals: UnitTotal[];
};

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function UnitTotals({ totals }: { totals: UnitTotal[] }) {
  if (!totals.length) return <span className="text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {totals.map((entry) => (
        <span key={entry.unit} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">
          {entry.total} {entry.unit}
        </span>
      ))}
    </div>
  );
}

export default function MonthlyBranchReportPage() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [branchSearch, setBranchSearch] = useState("");
  const [items, setItems] = useState<StationeryItem[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [unitTotals, setUnitTotals] = useState<UnitTotal[]>([]);
  const [period, setPeriod] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/stationery/reports/monthly?month=${selectedMonth}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Monthly report load nahi ho payi");
      setItems(data.stationeryItems || []);
      setRows(data.rows || []);
      setUnitTotals(data.unitTotals || []);
      setPeriod(data.period || { start: "", end: "" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Monthly report load nahi ho payi");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { void load(); }, [load]);

  const filteredRows = useMemo(() => {
    const query = branchSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => `${row.branchName} ${row.branchCode || ""}`.toLowerCase().includes(query));
  }, [branchSearch, rows]);

  const filteredItemTotals = useMemo(() => items.map((item) => ({
    ...item,
    total: filteredRows.reduce((sum, row) => sum + (row.itemQuantities.find((entry) => entry.itemId === item._id)?.quantity || 0), 0),
  })), [filteredRows, items]);

  const filteredUnitTotals = useMemo(() => Object.entries(filteredItemTotals.reduce<Record<string, number>>((acc, item) => {
    if (item.total > 0) acc[item.unit] = (acc[item.unit] || 0) + item.total;
    return acc;
  }, {})).map(([unit, total]) => ({ unit, total })), [filteredItemTotals]);

  function exportCsv() {
    const headers = ["Sr.", "Branch Code", "PS/Branch", ...items.map((item) => `${item.name} (${item.unit})`)];
    const body = filteredRows.map((row, index) => [
      index + 1,
      row.branchCode || "",
      row.branchName,
      ...items.map((item) => row.itemQuantities.find((entry) => entry.itemId === item._id)?.quantity || 0),
    ]);
    body.push(["", "", "Item Total", ...filteredItemTotals.map((item) => item.total)]);
    const csv = [headers, ...body].map((line) => line.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stationery-monthly-report-${selectedMonth}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-[1700px]">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/stationery-bills" className="text-sm font-bold text-blue-700">← Back to Stationery Bills</Link>
            <h1 className="mt-2 text-3xl font-black text-gray-900">Monthly Branch Report</h1>
            <p className="mt-2 text-gray-600">Historical inactive branches/items भी actual issue records के अनुसार report में बने रहते हैं।</p>
          </div>
          <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-gray-500">Unit-wise total</p>
            <div className="mt-2"><UnitTotals totals={branchSearch ? filteredUnitTotals : unitTotals} /></div>
          </div>
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div>}

        <section className="mb-6 grid gap-4 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-bold text-gray-700">Select Month
            <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" />
          </label>
          <label className="text-sm font-bold text-gray-700">Search Branch
            <input value={branchSearch} onChange={(event) => setBranchSearch(event.target.value)} placeholder="Name or branch code" className="mt-2 w-full rounded-xl border px-4 py-3" />
          </label>
          <div className="rounded-xl bg-blue-50 p-4 text-sm"><b>Period</b><div className="mt-1 text-blue-800">{period.start || "—"} to {period.end || "—"}</div></div>
          <div className="rounded-xl bg-gray-50 p-4 text-sm"><b>Records</b><div className="mt-1">Branches: {filteredRows.length} · Items: {items.length}</div></div>
          <div className="flex items-end gap-2">
            <button onClick={() => void load()} disabled={loading} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50">{loading ? "Loading..." : "Refresh"}</button>
            <button onClick={exportCsv} disabled={loading || !filteredRows.length} className="flex-1 rounded-xl border border-green-600 px-4 py-3 font-bold text-green-700 disabled:opacity-40">CSV</button>
            <button onClick={() => window.print()} className="rounded-xl border px-4 py-3 font-bold">Print</button>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[2400px] border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-20 border-b border-r bg-gray-50 p-3 text-left">Sr.</th>
                  <th className="sticky left-[55px] z-20 min-w-[220px] border-b border-r bg-gray-50 p-3 text-left">PS/Branch</th>
                  {items.map((item) => <th key={item._id} className="min-w-[125px] border-b border-r p-3 text-center text-xs">{item.name}<div className="mt-1 font-normal text-gray-500">{item.unit}</div></th>)}
                  <th className="min-w-[180px] border-b bg-gray-100 p-3 text-center">Unit-wise Total</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={items.length + 3} className="p-10 text-center">Loading report...</td></tr>}
                {!loading && filteredRows.map((row, index) => (
                  <tr key={row.branchId} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 border-b border-r bg-white p-3">{index + 1}</td>
                    <td className="sticky left-[55px] z-10 border-b border-r bg-white p-3 font-bold">{row.branchName}{row.branchCode ? <div className="text-xs font-medium text-gray-500">{row.branchCode}</div> : null}</td>
                    {items.map((item) => {
                      const quantity = row.itemQuantities.find((entry) => entry.itemId === item._id)?.quantity || 0;
                      return <td key={`${row.branchId}-${item._id}`} className="border-b border-r p-3 text-center font-semibold">{quantity || "—"}</td>;
                    })}
                    <td className="border-b bg-gray-50 p-3"><UnitTotals totals={row.unitTotals || []} /></td>
                  </tr>
                ))}
                {!loading && !filteredRows.length && <tr><td colSpan={items.length + 3} className="p-10 text-center text-gray-500">No branch data found.</td></tr>}
              </tbody>
              {!loading && filteredRows.length > 0 && (
                <tfoot><tr className="bg-gray-100">
                  <td colSpan={2} className="sticky left-0 z-20 border-r bg-gray-100 p-4 text-right font-black">Item Total</td>
                  {filteredItemTotals.map((item) => <td key={item._id} className="border-r p-3 text-center font-black">{item.total || "—"}</td>)}
                  <td className="p-3"><UnitTotals totals={filteredUnitTotals} /></td>
                </tr></tfoot>
              )}
            </table>
          </div>
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-900">Different units (Box, Ream, Nos आदि) को आपस में जोड़कर एक misleading grand total नहीं दिखाया जाता। Totals हमेशा unit-wise हैं।</p>
        </section>
      </div>
    </main>
  );
}
