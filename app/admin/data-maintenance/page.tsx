"use client";

import Link from "next/link";
import { useState } from "react";

type NegativeBalance = { itemName: string; unit: string; balance: number };

export default function DataMaintenancePage() {
  const [message, setMessage] = useState("");
  const [negativeBalances, setNegativeBalances] = useState<NegativeBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function migrate() {
    const confirmText = window.prompt("Database migration चलाने के लिए MIGRATE लिखें। इसे updated ZIP पहली बार लगाने के बाद एक बार चलाना है।");
    if (confirmText !== "MIGRATE") return;
    setLoading(true); setMessage(""); setNegativeBalances([]); setSuccess(false);
    try {
      const response = await fetch("/api/admin/migrate-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "MIGRATE" }) });
      const data = await response.json();
      setMessage(data.message || "Migration response received");
      setNegativeBalances(data.negativeBalances || []);
      setSuccess(Boolean(response.ok && data.success));
    } catch { setMessage("Migration request failed"); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6"><div className="mx-auto max-w-4xl">
    <Link href="/admin" className="text-sm font-bold text-blue-700">← Back to Admin</Link>
    <h1 className="mt-2 text-3xl font-black">Data Maintenance</h1>
    <p className="mt-2 text-gray-600">Existing database को नए safe stock system के साथ synchronize करने के लिए। Migration से पहले database backup जरूरी है।</p>
    <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-6"><h2 className="text-xl font-black text-orange-950">One-time Migration</h2><p className="mt-2 leading-7 text-orange-900">Updated project पहली बार run करने के बाद केवल एक बार चलाएँ। यह legacy document numbers/status backfill करेगी, stock transactions से balances rebuild करेगी और indexes create करेगी। Negative legacy stock मिलने पर migration बिना stock बदलें रुक जाएगी।</p><button disabled={loading} onClick={() => void migrate()} className="mt-5 rounded-xl bg-orange-600 px-6 py-3 font-bold text-white disabled:opacity-50">{loading ? "Running..." : "Run One-time Migration"}</button></div>
    {message && <div className={`mt-5 rounded-xl border p-4 font-semibold ${success ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}>{message}</div>}
    {negativeBalances.length > 0 && <div className="mt-5 rounded-2xl border border-red-200 bg-white p-5"><h2 className="font-black text-red-800">Items requiring old-record correction</h2><div className="mt-3 overflow-x-auto"><table className="w-full"><thead className="bg-red-50"><tr><th className="p-3 text-left">Item</th><th className="p-3 text-left">Unit</th><th className="p-3 text-right">Calculated Balance</th></tr></thead><tbody>{negativeBalances.map((entry) => <tr key={`${entry.itemName}-${entry.unit}`} className="border-t"><td className="p-3 font-bold">{entry.itemName}</td><td className="p-3">{entry.unit}</td><td className="p-3 text-right font-black text-red-700">{entry.balance}</td></tr>)}</tbody></table></div><p className="mt-4 text-sm text-red-800">इन items की old Purchase/Out transactions verify करने के बाद migration दोबारा चलाएँ।</p></div>}
  </div></main>;
}
