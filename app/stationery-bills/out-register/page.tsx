"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { SingleSelectTileModal } from "@/components/stationery/TileSelectionModals";

type Branch = { _id: string; name: string; code: string };
type OutItem = { itemName: string; quantity: number; unit: string };
type OutEntry = {
  _id: string;
  issueNo?: string;
  issueDate: string;
  branchName: string;
  branchCode?: string;
  receiverName?: string;
  items: OutItem[];
  remarks?: string;
  status?: "ACTIVE" | "VOID";
  voidReason?: string;
};

type Pagination = { page: number; limit: number; total: number; pages: number };

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthRange() {
  const today = new Date();
  return {
    from: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: formatDate(today),
  };
}

export default function OutRegisterPage() {
  const initialRange = useMemo(() => currentMonthRange(), []);
  const [entries, setEntries] = useState<OutEntry[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchTileColumns, setBranchTileColumns] = useState(6);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [branchSelectorOpen, setBranchSelectorOpen] = useState(false);

  useEffect(() => {
    async function loadMaster() {
      try {
        const [branchResponse, settingsResponse] = await Promise.all([
          fetch("/api/stationery/branches"),
          fetch("/api/admin/selector-settings"),
        ]);
        const [branchData, settingsData] = await Promise.all([branchResponse.json(), settingsResponse.json()]);
        if (branchData.success) setBranches(branchData.branches || []);
        if (settingsData.success) setBranchTileColumns(settingsData.settings?.branchTileColumns || 6);
      } catch {
        // Register can still load even if optional branch selector settings fail.
      }
    }
    void loadMaster();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setIsError(false);
    try {
      const params = new URLSearchParams({ status, limit: "50", page: String(page) });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (branchId) params.set("branchId", branchId);
      if (appliedSearch) params.set("search", appliedSearch);
      const response = await fetch(`/api/stationery/out-entries?${params}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Out register load nahi hua");
      setEntries(data.entries || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 1 });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Out register load nahi hua");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, branchId, from, page, status, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedBranch = branches.find((branch) => branch._id === branchId);
  const visibleQuantity = entries.reduce(
    (total, entry) => total + entry.items.reduce((itemTotal, item) => itemTotal + Number(item.quantity || 0), 0),
    0
  );

  function applySearch() {
    setPage(1);
    setAppliedSearch(searchInput.trim());
  }

  function setCurrentMonth() {
    const range = currentMonthRange();
    setFrom(range.from);
    setTo(range.to);
    setPage(1);
  }

  function clearFilters() {
    const range = currentMonthRange();
    setFrom(range.from);
    setTo(range.to);
    setBranchId("");
    setStatus("ALL");
    setSearchInput("");
    setAppliedSearch("");
    setPage(1);
  }

  async function cancel(entry: OutEntry) {
    const reason = window.prompt("Out entry cancel karne ka reason likhein:");
    if (!reason) return;
    const response = await fetch("/api/stationery/out-entries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry._id, action: "void", reason }),
    });
    const data = await response.json();
    if (response.ok && data.success) {
      await load();
      setMessage(data.message || "Out entry cancelled successfully");
      setIsError(false);
    } else {
      setMessage(data.message || "Out entry cancel nahi hui");
      setIsError(true);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/stationery-bills" className="text-sm font-bold text-blue-700">← Back to Stationery Bills</Link>
            <h1 className="mt-2 text-3xl font-black">Stationery Out Register</h1>
            <p className="mt-2 text-gray-600">Branch search, exact date range aur status ke saath issue history manage karein.</p>
          </div>
          <Link href="/stationery-bills/out-entry" className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">+ New Out Entry</Link>
        </div>

        <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[160px_160px_1fr_180px_1fr_auto]">
            <label className="text-xs font-black uppercase text-gray-500">
              From Date
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => { setFrom(event.target.value); setPage(1); }}
                className="mt-1 w-full rounded-xl border px-3 py-3 text-sm font-semibold text-gray-900"
              />
            </label>
            <label className="text-xs font-black uppercase text-gray-500">
              To Date
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => { setTo(event.target.value); setPage(1); }}
                className="mt-1 w-full rounded-xl border px-3 py-3 text-sm font-semibold text-gray-900"
              />
            </label>
            <label className="text-xs font-black uppercase text-gray-500">
              PS/Branch Filter
              <button
                type="button"
                onClick={() => setBranchSelectorOpen(true)}
                className={`mt-1 w-full truncate rounded-xl border px-3 py-3 text-left text-sm font-bold ${selectedBranch ? "border-blue-400 bg-blue-50 text-blue-900" : "text-gray-600"}`}
              >
                {selectedBranch ? `${selectedBranch.name} (${selectedBranch.code})` : "All Branches / Select"}
              </button>
            </label>
            <label className="text-xs font-black uppercase text-gray-500">
              Status
              <select
                value={status}
                onChange={(event) => { setStatus(event.target.value); setPage(1); }}
                className="mt-1 w-full rounded-xl border px-3 py-3 text-sm font-semibold text-gray-900"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="VOID">Cancelled</option>
              </select>
            </label>
            <label className="text-xs font-black uppercase text-gray-500">
              Search
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") applySearch(); }}
                placeholder="Issue no., branch, receiver..."
                className="mt-1 w-full rounded-xl border px-3 py-3 text-sm font-semibold text-gray-900"
              />
            </label>
            <div className="flex items-end gap-2">
              <button type="button" onClick={applySearch} className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-black text-white">Apply</button>
              <button type="button" onClick={() => void load()} className="rounded-xl border px-4 py-3 text-sm font-black">↻</button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={setCurrentMonth} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">Current Month</button>
            {branchId ? <button type="button" onClick={() => { setBranchId(""); setPage(1); }} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700">Clear Branch</button> : null}
            <button type="button" onClick={clearFilters} className="rounded-lg border px-3 py-2 text-xs font-black text-gray-700">Reset Filters</button>
          </div>
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-500">Matching Records</div>
            <div className="mt-1 text-2xl font-black text-blue-700">{pagination.total}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-500">Quantity on Current Page</div>
            <div className="mt-1 text-2xl font-black text-green-700">{visibleQuantity}</div>
          </div>
        </div>

        {message ? (
          <div className={`mb-5 rounded-xl border p-4 font-semibold ${isError ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-900"}`}>
            {message}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[950px]">
            <thead className="bg-gray-900 text-white">
              <tr>
                <th className="p-3 text-left">Issue No.</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Branch</th>
                <th className="p-3 text-left">Receiver</th>
                <th className="p-3 text-center">Items</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <Fragment key={entry._id}>
                  <tr className="border-b">
                    <td className="p-3 font-bold">{entry.issueNo || entry._id.slice(-8).toUpperCase()}</td>
                    <td className="p-3">{new Date(entry.issueDate).toLocaleDateString("en-IN")}</td>
                    <td className="p-3">{entry.branchName}{entry.branchCode ? ` (${entry.branchCode})` : ""}</td>
                    <td className="p-3">{entry.receiverName || "—"}</td>
                    <td className="p-3 text-center">{entry.items.length}</td>
                    <td className="p-3 text-center">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${entry.status === "VOID" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {entry.status || "ACTIVE"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button type="button" onClick={() => setExpanded(expanded === entry._id ? null : entry._id)} className="mr-2 rounded-lg border px-3 py-2 text-sm font-bold">
                        {expanded === entry._id ? "Hide" : "View"}
                      </button>
                      {entry.status !== "VOID" ? (
                        <button type="button" onClick={() => void cancel(entry)} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white">Cancel</button>
                      ) : null}
                    </td>
                  </tr>
                  {expanded === entry._id ? (
                    <tr>
                      <td colSpan={7} className="bg-gray-50 p-4">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {entry.items.map((item, index) => (
                            <div key={`${item.itemName}-${index}`} className="rounded-lg border bg-white p-3">
                              <b>{item.itemName}</b>
                              <div>{item.quantity} {item.unit}</div>
                            </div>
                          ))}
                        </div>
                        {entry.remarks ? <p className="mt-3"><b>Remarks:</b> {entry.remarks}</p> : null}
                        {entry.voidReason ? <p className="mt-2 text-red-700"><b>Cancellation:</b> {entry.voidReason}</p> : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {loading ? <tr><td colSpan={7} className="p-10 text-center">Loading...</td></tr> : null}
              {!loading && !entries.length ? <tr><td colSpan={7} className="p-10 text-center text-gray-500">No entries found for selected filters.</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-sm font-bold text-gray-600">Page {pagination.page} of {pagination.pages} · {pagination.total} records</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page <= 1 || loading}
              className="rounded-xl border px-4 py-2 font-bold disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(current + 1, pagination.pages))}
              disabled={page >= pagination.pages || loading}
              className="rounded-xl border px-4 py-2 font-bold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <SingleSelectTileModal
        open={branchSelectorOpen}
        title="Filter by PS/Branch"
        subtitle="Ek branch select karein ya Clear karke all branches dekhein."
        options={branches.map((branch) => ({ id: branch._id, label: branch.name, secondary: branch.code }))}
        value={branchId}
        columns={branchTileColumns}
        onClose={() => setBranchSelectorOpen(false)}
        onApply={(id) => { setBranchId(id); setPage(1); }}
      />
    </main>
  );
}
