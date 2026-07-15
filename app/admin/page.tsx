import Link from "next/link";

const modules = [
  { title: "PS/Branches", description: "Branch name, code, active/inactive status manage karein.", href: "/admin/stationery/branches", icon: "🏢" },
  { title: "Stationery Items", description: "Item name, unit aur minimum stock manage karein.", href: "/admin/stationery/items", icon: "📦" },
  { title: "Popup Selection Settings", description: "Branch/item tile order aur desktop tiles-per-row control karein.", href: "/admin/selector-settings", icon: "▦" },
  { title: "Opening Stock", description: "Only first-time opening stock setup; operational entries ke baad auto-lock.", href: "/admin/stationery/opening-stock", icon: "📥" },
  { title: "Activity / Audit Log", description: "Important create, update, cancellation aur correction history.", href: "/admin/audit-log", icon: "🧾" },
  { title: "Data Maintenance", description: "One-time migration, legacy numbering aur stock balance rebuild.", href: "/admin/data-maintenance", icon: "🛠️" },
  { title: "Office & PDF Settings", description: "Office name, district, committee text aur signature labels.", href: "/admin/office-settings", icon: "⚙️" },
];

export default function AdminDashboardPage() {
  return <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl"><h1 className="text-3xl font-black text-gray-900">Admin Panel</h1><p className="mt-2 text-gray-600">Master data, opening setup aur audit controls.</p><div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{modules.map((module) => <Link key={module.href} href={module.href} className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl"><div className="mb-5 text-4xl">{module.icon}</div><h2 className="text-xl font-black group-hover:text-blue-700">{module.title}</h2><p className="mt-3 text-sm leading-6 text-gray-600">{module.description}</p><div className="mt-6 text-sm font-black text-blue-700">Open →</div></Link>)}</div></div></main>;
}
