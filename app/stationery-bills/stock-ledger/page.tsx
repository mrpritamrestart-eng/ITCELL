"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SingleSelectTileModal } from "@/components/stationery/TileSelectionModals";

type Item = { _id: string; name: string; unit: string };
type LedgerRow = {
  _id: string;
  transactionDate: string;
  transactionType: string;
  quantityIn: number;
  quantityOut: number;
  branchName?: string;
  remarks?: string;
  runningBalance: number;
};

export default function StockLedgerPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [itemId, setItemId] = useState("");
  const [itemTileColumns, setItemTileColumns] = useState(6);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadMaster() {
      const [itemResponse, settingsResponse] = await Promise.all([
        fetch("/api/stationery/items"),
        fetch("/api/admin/selector-settings"),
      ]);
      const [itemData, settingsData] = await Promise.all([itemResponse.json(), settingsResponse.json()]);
      if (itemData.success) setItems(itemData.items || []);
      else setMessage(itemData.message || "Items load nahi hue");
      if (settingsData.success) setItemTileColumns(settingsData.settings?.itemTileColumns || 6);
    }
    void loadMaster();
  }, []);

  async function loadLedger() {
    if (!itemId) {
      setMessage("Pehle popup se stationery item select karein");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ itemId });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const response = await fetch(`/api/stationery/stock-ledger?${params}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Ledger load nahi hua");
      setRows(data.ledger || []);
      setOpeningBalance(data.openingBalance || 0);
      setClosingBalance(data.closingBalance || 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ledger load nahi hua");
    } finally {
      setLoading(false);
    }
  }

  const selectedItem = items.find((item) => item._id === itemId);

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Link href="/stationery-bills" className="text-sm font-bold text-blue-700">← Back to Stationery Bills</Link>
        <h1 className="mt-2 text-3xl font-black">Item-wise Stock Ledger</h1>
        <p className="mt-2 text-gray-600">Opening, purchase, issue aur adjustment ki complete movement history.</p>

        <div className="my-6 grid gap-3 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-[1fr_180px_180px_auto]">
          <button
            type="button"
            onClick={() => setSelectorOpen(true)}
            className={`rounded-xl border px-4 py-3 text-left font-bold ${selectedItem ? "border-blue-400 bg-blue-50 text-blue-900" : "text-gray-600"}`}
          >
            {selectedItem ? `${selectedItem.name} (${selectedItem.unit})` : "Select stationery item from popup"}
          </button>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border px-4 py-3" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border px-4 py-3" />
          <button type="button" onClick={() => void loadLedger()} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">
            {loading ? "Loading..." : "Load Ledger"}
          </button>
        </div>

        {message ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">{message}</div> : null}

        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm"><div className="text-sm text-gray-500">Opening Balance</div><div className="text-2xl font-black">{openingBalance}</div></div>
          <div className="rounded-2xl bg-white p-5 shadow-sm"><div className="text-sm text-gray-500">Closing Balance</div><div className="text-2xl font-black text-blue-700">{closingBalance}</div></div>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-900 text-white">
              <tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Branch/Reference</th><th className="p-3 text-right">In</th><th className="p-3 text-right">Out</th><th className="p-3 text-right">Balance</th><th className="p-3 text-left">Remarks</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-b">
                  <td className="p-3">{new Date(row.transactionDate).toLocaleDateString("en-IN")}</td>
                  <td className="p-3 font-bold">{row.transactionType.replaceAll("_", " ")}</td>
                  <td className="p-3">{row.branchName || "Office Stock"}</td>
                  <td className="p-3 text-right text-green-700">{row.quantityIn || "—"}</td>
                  <td className="p-3 text-right text-red-700">{row.quantityOut || "—"}</td>
                  <td className="p-3 text-right font-black">{row.runningBalance}</td>
                  <td className="p-3">{row.remarks || "—"}</td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={7} className="p-10 text-center text-gray-500">Select item and load ledger.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <SingleSelectTileModal
        open={selectorOpen}
        title="Select Stationery Item"
        subtitle="Search ya compact tile se ek item select karein."
        options={items.map((item) => ({ id: item._id, label: item.name, secondary: item.unit }))}
        value={itemId}
        columns={itemTileColumns}
        onClose={() => setSelectorOpen(false)}
        onApply={setItemId}
      />
    </main>
  );
}
