"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type Option = { _id: string; invoiceNo: string; month: string; acceptedFirmName: string; approvedQuotationAmount: number };
type Bill = {
  _id: string; billNo?: string; calculation: string; quotationInvoiceNo: string; month: string;
  acceptedFirmName: string; approvedQuotationAmount: number; vendorInvoiceNo: string; vendorInvoiceDate: string;
  invoiceAmount: number; deductions: number; netPayable: number; varianceReason?: string; remarks?: string;
  status: "DRAFT" | "APPROVED" | "PAID" | "VOID"; paymentDate?: string; paymentReference?: string;
  voidReason?: string; createdAt: string;
};

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function money(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0)); }
function statusClass(status: Bill["status"]) {
  if (status === "PAID") return "bg-green-100 text-green-800";
  if (status === "APPROVED") return "bg-blue-100 text-blue-800";
  if (status === "VOID") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

export default function FinalBillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState("");
  const [calculationId, setCalculationId] = useState("");
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState("");
  const [vendorInvoiceDate, setVendorInvoiceDate] = useState(today());
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [deductions, setDeductions] = useState("0");
  const [varianceReason, setVarianceReason] = useState("");
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      const response = await fetch(`/api/stationery/vendor-bills?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Final bills load nahi hue");
      setBills(data.bills || []);
      setOptions(data.availableCalculations || []);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Final bills load nahi hue"); setError(true);
    } finally { setLoading(false); }
  }, [search, status]);

  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);

  const selectedOption = useMemo(() => options.find((entry) => entry._id === calculationId), [calculationId, options]);
  const netPayable = Math.max((Number(invoiceAmount) || 0) - (Number(deductions) || 0), 0);

  function reset() {
    setEditingId(""); setCalculationId(""); setVendorInvoiceNo(""); setVendorInvoiceDate(today()); setInvoiceAmount(""); setDeductions("0"); setVarianceReason(""); setRemarks("");
  }

  function edit(bill: Bill) {
    setEditingId(bill._id); setCalculationId(String(bill.calculation)); setVendorInvoiceNo(bill.vendorInvoiceNo);
    setVendorInvoiceDate(new Date(bill.vendorInvoiceDate).toLocaleDateString("en-CA")); setInvoiceAmount(String(bill.invoiceAmount)); setDeductions(String(bill.deductions));
    setVarianceReason(bill.varianceReason || ""); setRemarks(bill.remarks || ""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    setSaving(true); setMessage(""); setError(false);
    try {
      const response = await fetch("/api/stationery/vendor-bills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, calculationId, vendorInvoiceNo, vendorInvoiceDate, invoiceAmount: Number(invoiceAmount), deductions: Number(deductions || 0), varianceReason, remarks }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Final bill save nahi hua");
      setMessage(data.message); reset(); await load();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Final bill save nahi hua"); setError(true); }
    finally { setSaving(false); }
  }

  async function action(bill: Bill, actionName: "approve" | "pay" | "void") {
    let payload: Record<string, unknown> = { id: bill._id, action: actionName };
    if (actionName === "void") {
      const reason = window.prompt("Cancellation reason (minimum 5 characters):"); if (!reason) return; payload = { ...payload, reason };
    }
    if (actionName === "pay") {
      const paymentDate = window.prompt("Payment date (YYYY-MM-DD):", today()); if (!paymentDate) return;
      const paymentReference = window.prompt("Payment reference / cheque / transaction no.:"); if (!paymentReference) return;
      payload = { ...payload, paymentDate, paymentReference };
    }
    if (actionName === "approve" && !window.confirm("Draft bill approve karna hai? Approve hone ke baad amount edit nahi hoga.")) return;
    setMessage(""); setError(false);
    try {
      const response = await fetch("/api/stationery/vendor-bills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || "Bill update nahi hua");
      setMessage(data.message); await load();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Bill update nahi hua"); setError(true); }
  }

  return <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl">
    <div className="mb-7"><Link href="/stationery-bills" className="text-sm font-bold text-blue-700">← Back to Stationery Bills</Link><h1 className="mt-2 text-3xl font-black">Final Vendor Bills</h1><p className="mt-2 text-gray-600">Accepted comparative quotation से vendor invoice, approval और payment tracking.</p></div>
    {message && <div className={`mb-5 rounded-xl border p-4 font-bold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>{message}</div>}

    <section className="mb-7 rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-black">{editingId ? "Edit Draft Bill" : "Create Final Bill Draft"}</h2><p className="text-sm text-gray-500">Only active accepted calculations appear here.</p></div>{editingId && <button onClick={reset} className="rounded-xl border px-4 py-2 font-bold">Cancel Edit</button>}</div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-bold">Accepted Quotation<select disabled={Boolean(editingId)} value={calculationId} onChange={(event) => { const id = event.target.value; setCalculationId(id); const option = options.find((entry) => entry._id === id); if (option) setInvoiceAmount(String(option.approvedQuotationAmount)); }} className="mt-2 w-full rounded-xl border px-4 py-3"><option value="">Select calculation</option>{editingId && !options.some((entry) => entry._id === calculationId) ? <option value={calculationId}>Current linked quotation</option> : null}{options.map((entry) => <option key={entry._id} value={entry._id}>{entry.invoiceNo} · {entry.acceptedFirmName} · {money(entry.approvedQuotationAmount)}</option>)}</select></label>
        <label className="text-sm font-bold">Vendor Invoice No.<input value={vendorInvoiceNo} onChange={(event) => setVendorInvoiceNo(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3"/></label>
        <label className="text-sm font-bold">Invoice Date<input type="date" max={today()} value={vendorInvoiceDate} onChange={(event) => setVendorInvoiceDate(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3"/></label>
        <label className="text-sm font-bold">Invoice Amount<input type="number" min="0.01" step="0.01" value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 text-right"/></label>
        <label className="text-sm font-bold">Deductions<input type="number" min="0" step="0.01" value={deductions} onChange={(event) => setDeductions(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 text-right"/></label>
        <label className="text-sm font-bold md:col-span-2">Variance Reason<input value={varianceReason} onChange={(event) => setVarianceReason(event.target.value)} placeholder="Required only when invoice exceeds accepted quotation" className="mt-2 w-full rounded-xl border px-4 py-3"/></label>
        <div className="rounded-xl bg-green-50 p-4 text-right"><div className="text-xs font-bold uppercase text-green-700">Net Payable</div><div className="mt-1 text-2xl font-black text-green-800">{money(netPayable)}</div>{selectedOption && <div className="mt-1 text-xs text-gray-600">Approved: {money(selectedOption.approvedQuotationAmount)}</div>}</div>
      </div>
      <textarea rows={2} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Remarks" className="mt-4 w-full rounded-xl border px-4 py-3"/>
      <div className="mt-4 flex justify-end"><button disabled={saving || !calculationId} onClick={() => void save()} className="rounded-xl bg-green-600 px-6 py-3 font-black text-white disabled:opacity-40">{saving ? "Saving..." : editingId ? "Update Draft" : "Save Draft"}</button></div>
    </section>

    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Final Bill Register</h2><p className="text-sm text-gray-500">Draft → Approved → Paid workflow.</p></div><div className="flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search bill/invoice/firm" className="rounded-xl border px-4 py-2"/><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border px-4 py-2"><option value="">All status</option><option>DRAFT</option><option>APPROVED</option><option>PAID</option><option>VOID</option></select><button onClick={() => window.print()} className="rounded-xl border px-4 py-2 font-bold">Print</button></div></div>
      <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[1100px]"><thead className="bg-gray-50"><tr><th className="p-3 text-left">Bill No.</th><th className="p-3 text-left">Month</th><th className="p-3 text-left">Firm / Vendor Invoice</th><th className="p-3 text-right">Approved Quote</th><th className="p-3 text-right">Net Payable</th><th className="p-3 text-center">Status</th><th className="p-3 text-center">Action</th></tr></thead><tbody>
        {bills.map((bill) => <Fragment key={bill._id}><tr className="border-t"><td className="p-3 font-black">{bill.billNo || bill._id.slice(-8)}</td><td className="p-3">{bill.month}</td><td className="p-3"><b>{bill.acceptedFirmName}</b><div className="text-xs text-gray-500">{bill.vendorInvoiceNo} · {new Date(bill.vendorInvoiceDate).toLocaleDateString("en-IN")}</div></td><td className="p-3 text-right">{money(bill.approvedQuotationAmount)}</td><td className="p-3 text-right font-black text-green-700">{money(bill.netPayable)}</td><td className="p-3 text-center"><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(bill.status)}`}>{bill.status}</span></td><td className="p-3 text-center"><button onClick={() => setExpanded(expanded === bill._id ? null : bill._id)} className="mr-2 rounded-lg border px-3 py-2 text-sm font-bold">{expanded === bill._id ? "Hide" : "View"}</button>{bill.status === "DRAFT" && <><button onClick={() => edit(bill)} className="mr-2 rounded-lg border border-blue-500 px-3 py-2 text-sm font-bold text-blue-700">Edit</button><button onClick={() => void action(bill,"approve")} className="mr-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white">Approve</button></>}{bill.status === "APPROVED" && <button onClick={() => void action(bill,"pay")} className="mr-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white">Mark Paid</button>}{bill.status !== "VOID" && <button onClick={() => void action(bill,"void")} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white">Cancel</button>}</td></tr>
        {expanded === bill._id && <tr><td colSpan={7} className="bg-gray-50 p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><b>Quotation Ref.</b><div>{bill.quotationInvoiceNo}</div></div><div><b>Invoice Amount</b><div>{money(bill.invoiceAmount)}</div></div><div><b>Deductions</b><div>{money(bill.deductions)}</div></div><div><b>Payment Ref.</b><div>{bill.paymentReference || "—"}</div></div></div>{bill.varianceReason && <p className="mt-3"><b>Variance:</b> {bill.varianceReason}</p>}{bill.remarks && <p className="mt-2"><b>Remarks:</b> {bill.remarks}</p>}{bill.voidReason && <p className="mt-2 text-red-700"><b>Cancellation:</b> {bill.voidReason}</p>}</td></tr>}</Fragment>)}
        {loading && <tr><td colSpan={7} className="p-10 text-center">Loading...</td></tr>}{!loading && !bills.length && <tr><td colSpan={7} className="p-10 text-center text-gray-500">No final bills found.</td></tr>}
      </tbody></table></div>
    </section>
  </div></main>;
}
