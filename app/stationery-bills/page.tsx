import Link from "next/link";

const modules = [
  { title: "New Purchase Entry", description: "Firm/shop se aaye stationery items stock me add karein.", href: "/stationery-bills/purchase-entry", icon: "🛒" },
  { title: "Purchase Register", description: "Purchase history, item details aur safe cancellation.", href: "/stationery-bills/purchase-register", icon: "📘" },
  { title: "Current Stock", description: "Live available stock, minimum level aur order requirement.", href: "/stationery-bills/current-stock", icon: "📦" },
  { title: "Stock Ledger", description: "Item-wise opening, purchase, issue aur adjustment movement.", href: "/stationery-bills/stock-ledger", icon: "📒" },
  { title: "Stock Adjustment", description: "Physical difference, return, damage या correction दर्ज करें.", href: "/stationery-bills/stock-adjustment", icon: "⚖️" },
  { title: "New Out Entry", description: "PS/Branch ko stationery issue karke stock minus karein.", href: "/stationery-bills/out-entry", icon: "📤" },
  { title: "Out Register", description: "Branch issue history aur safe cancellation/stock restoration.", href: "/stationery-bills/out-register", icon: "📙" },
  { title: "Monthly Branch Report", description: "Month-wise branch rows aur item columns wali report.", href: "/stationery-bills/monthly-report", icon: "📊" },
  { title: "Branch-wise Monthly Data", description: "Selected branches ka item-wise monthly issue data.", href: "/stationery-bills/branch-wise-report", icon: "🏢" },
  { title: "Permission & Comparative", description: "Permissions, quotation calculations aur comparative PDF.", href: "/stationery-bills/permission-comparative", icon: "📑" },
  { title: "Final Vendor Bills", description: "Accepted quotation se approval aur payment tracking complete karein.", href: "/stationery-bills/final-bills", icon: "🧾" },
];

export default function StationeryBillsPage() {
  return <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl">
    <div className="mb-8"><Link href="/" className="text-sm font-bold text-blue-700">← Back to Home</Link><h1 className="mt-2 text-3xl font-black text-gray-900">Stationery Bills & Inventory</h1><p className="mt-2 max-w-4xl text-gray-600">Purchase से final comparative तक complete internal workflow. सभी stock-changing entries audit और reversal safety के साथ handle होती हैं।</p></div>
    <div className="mb-8 rounded-2xl border border-blue-100 bg-blue-50 p-5"><h2 className="font-black text-blue-950">Recommended Workflow</h2><div className="mt-3 grid gap-3 text-sm font-semibold text-blue-900 md:grid-cols-5"><div className="rounded-xl bg-white p-3">1. Purchase</div><div className="rounded-xl bg-white p-3">2. Stock/Adjustment</div><div className="rounded-xl bg-white p-3">3. Branch Issue</div><div className="rounded-xl bg-white p-3">4. Permission</div><div className="rounded-xl bg-white p-3">5. Comparative & Bill</div></div></div>
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{modules.map((module) => <Link key={module.href} href={module.href} className="group flex min-h-[220px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-500 hover:shadow-lg"><div><div className="mb-4 text-4xl">{module.icon}</div><h2 className="text-lg font-black text-gray-900 group-hover:text-blue-700">{module.title}</h2><p className="mt-2 text-sm leading-6 text-gray-600">{module.description}</p></div><div className="mt-5 text-sm font-black text-blue-700">Open →</div></Link>)}</div>
  </div></main>;
}
