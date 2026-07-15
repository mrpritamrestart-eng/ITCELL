"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SortRow = {
  _id: string;
  name: string;
  code?: string;
  unit?: string;
  sortOrder: number;
};

type Settings = {
  branchTileColumns: number;
  itemTileColumns: number;
};

function normalize(rows: SortRow[]) {
  return rows.map((row, index) => ({ ...row, sortOrder: (index + 1) * 10 }));
}

function prepareRows(rows: SortRow[]) {
  return rows.map((row, index) => ({
    ...row,
    sortOrder: Number(row.sortOrder) > 0 ? Number(row.sortOrder) : (index + 1) * 10,
  }));
}

function SortOrderPanel({
  title,
  description,
  rows,
  search,
  onSearch,
  onRowsChange,
}: {
  title: string;
  description: string;
  rows: SortRow[];
  search: string;
  onSearch: (value: string) => void;
  onRowsChange: (rows: SortRow[]) => void;
}) {
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => `${row.name} ${row.code || ""} ${row.unit || ""}`.toLowerCase().includes(query));
  }, [rows, search]);

  function updateOrder(id: string, value: string) {
    onRowsChange(rows.map((row) => (row._id === id ? { ...row, sortOrder: Number(value) || 0 } : row)));
  }

  function move(id: string, direction: -1 | 1) {
    const index = rows.findIndex((row) => row._id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onRowsChange(normalize(next));
  }

  function sortAZ() {
    onRowsChange(normalize([...rows].sort((a, b) => a.name.localeCompare(b.name))));
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search..."
            className="rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <button type="button" onClick={sortAZ} className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-gray-50">
            Reset A–Z
          </button>
        </div>
      </div>

      <div className="mt-4 max-h-[560px] overflow-auto rounded-xl border">
        <table className="w-full min-w-[650px] border-collapse">
          <thead className="sticky top-0 bg-gray-100">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-black uppercase text-gray-600">Current</th>
              <th className="px-3 py-3 text-left text-xs font-black uppercase text-gray-600">Name</th>
              <th className="px-3 py-3 text-left text-xs font-black uppercase text-gray-600">Sort Order</th>
              <th className="px-3 py-3 text-center text-xs font-black uppercase text-gray-600">Move</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const actualIndex = rows.findIndex((entry) => entry._id === row._id);
              return (
                <tr key={row._id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-3 text-sm font-bold text-gray-500">{actualIndex + 1}</td>
                  <td className="px-3 py-3">
                    <div className="text-sm font-black text-gray-900">{row.name}</div>
                    {row.code || row.unit ? <div className="text-xs font-semibold text-gray-500">{row.code || row.unit}</div> : null}
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      value={row.sortOrder}
                      onChange={(event) => updateOrder(row._id, event.target.value)}
                      className="w-28 rounded-lg border px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="inline-flex overflow-hidden rounded-lg border">
                      <button
                        type="button"
                        onClick={() => move(row._id, -1)}
                        disabled={actualIndex <= 0}
                        className="px-3 py-2 font-black hover:bg-gray-100 disabled:opacity-30"
                        aria-label={`Move ${row.name} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(row._id, 1)}
                        disabled={actualIndex < 0 || actualIndex >= rows.length - 1}
                        className="border-l px-3 py-2 font-black hover:bg-gray-100 disabled:opacity-30"
                        aria-label={`Move ${row.name} down`}
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center font-semibold text-gray-500">
                  No matching record.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SelectorSettingsPage() {
  const [settings, setSettings] = useState<Settings>({ branchTileColumns: 6, itemTileColumns: 6 });
  const [branches, setBranches] = useState<SortRow[]>([]);
  const [items, setItems] = useState<SortRow[]>([]);
  const [branchSearch, setBranchSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/selector-settings");
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Settings load nahi hui");
      setSettings(data.settings || { branchTileColumns: 6, itemTileColumns: 6 });
      setBranches(prepareRows(data.branches || []));
      setItems(prepareRows(data.items || []));
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Settings load nahi hui");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/admin/selector-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          branchOrders: branches.map((row) => ({ id: row._id, sortOrder: row.sortOrder })),
          itemOrders: items.map((row) => ({ id: row._id, sortOrder: row.sortOrder })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Settings save nahi hui");
      setMessage(data.message || "Settings saved");
      await load();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Settings save nahi hui");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="text-sm font-bold text-blue-700">
          ← Back to Admin Panel
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Popup Selection Settings</h1>
            <p className="mt-2 text-gray-600">Popup tiles ka order aur desktop/laptop par ek row me tiles ki sankhya set karein.</p>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={loading || saving}
            className="rounded-xl bg-green-600 px-6 py-3 font-black text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save All Settings"}
          </button>
        </div>

        {message ? (
          <div className={`my-5 rounded-xl border p-4 font-bold ${isError ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>
            {message}
          </div>
        ) : null}

        <section className="my-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-black text-blue-950">Tile Size / Tiles Per Row</h2>
          <p className="mt-1 text-sm text-blue-900">Mobile par layout automatically 2–4 tiles rahega. Ye setting desktop/laptop popup ke liye hai.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="font-bold text-blue-950">
              PS/Branches tiles per row
              <input
                type="number"
                min="3"
                max="10"
                value={settings.branchTileColumns}
                onChange={(event) => setSettings((current) => ({ ...current, branchTileColumns: Number(event.target.value) || 3 }))}
                className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 font-black outline-none focus:border-blue-500"
              />
            </label>
            <label className="font-bold text-blue-950">
              Stationery Items tiles per row
              <input
                type="number"
                min="3"
                max="10"
                value={settings.itemTileColumns}
                onChange={(event) => setSettings((current) => ({ ...current, itemTileColumns: Number(event.target.value) || 3 }))}
                className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 font-black outline-none focus:border-blue-500"
              />
            </label>
          </div>
        </section>

        {loading ? <div className="rounded-2xl bg-white p-12 text-center font-bold text-gray-500">Settings loading...</div> : null}

        {!loading ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <SortOrderPanel
              title="PS/Branches Sort Order"
              description="Smaller sort order popup me pehle show hoga. Arrow buttons se bhi order badal sakte hain."
              rows={branches}
              search={branchSearch}
              onSearch={setBranchSearch}
              onRowsChange={setBranches}
            />
            <SortOrderPanel
              title="Stationery Items Sort Order"
              description="Frequently used items ko top par rakhne ke liye smaller order dein."
              rows={items}
              search={itemSearch}
              onSearch={setItemSearch}
              onRowsChange={setItems}
            />
          </div>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void save()}
            disabled={loading || saving}
            className="rounded-xl bg-green-600 px-6 py-3 font-black text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save All Settings"}
          </button>
        </div>
      </div>
    </main>
  );
}
