"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Log = { _id: string; createdAt: string; action: string; entityType: string; performedBy: string; summary: string };
export default function AuditLogPage() {
  const [logs, setLogs] = useState<Log[]>([]); const [message, setMessage] = useState("");
  useEffect(() => { void fetch("/api/stationery/audit-log").then((r) => r.json()).then((data) => data.success ? setLogs(data.logs || []) : setMessage(data.message)); }, []);
  return <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl"><Link href="/admin" className="text-sm font-bold text-blue-700">← Back to Admin</Link><h1 className="mt-2 text-3xl font-black">Activity / Audit Log</h1><p className="mt-2 text-gray-600">Important create, update, cancellation and stock correction activities.</p>{message && <div className="my-5 rounded-xl bg-red-50 p-4 text-red-800">{message}</div>}<div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm"><table className="w-full min-w-[850px]"><thead className="bg-gray-900 text-white"><tr><th className="p-3 text-left">Date & Time</th><th className="p-3 text-left">Action</th><th className="p-3 text-left">Module</th><th className="p-3 text-left">User</th><th className="p-3 text-left">Details</th></tr></thead><tbody>{logs.map((log) => <tr key={log._id} className="border-b"><td className="p-3">{new Date(log.createdAt).toLocaleString("en-IN")}</td><td className="p-3 font-bold">{log.action}</td><td className="p-3">{log.entityType}</td><td className="p-3">{log.performedBy}</td><td className="p-3">{log.summary}</td></tr>)}</tbody></table></div></div></main>;
}
