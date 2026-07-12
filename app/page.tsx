import Link from "next/link";

const tiles = [
  { title: "Stationery Bills", href: "/stationery-bills", icon: "📝", active: true, description: "Complete stock, permission, quotation and billing workflow." },
  { title: "IT Bills", icon: "💻", active: false, description: "Next development phase." },
  { title: "Internet Bills", icon: "🌐", active: false, description: "Next development phase." },
  { title: "Printing Press", icon: "🖨️", active: false, description: "Next development phase." },
  { title: "Photostate", icon: "📄", active: false, description: "Next development phase." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black text-gray-900">Office Billing System</h1>
          <p className="mt-3 text-lg text-gray-600">Internal official-use billing and inventory system</p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {tiles.map((tile) => tile.active ? (
            <Link key={tile.title} href={tile.href || "/"} className="group flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-blue-200 bg-white p-6 text-center shadow-md transition hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-5xl group-hover:bg-blue-600">{tile.icon}</div>
              <h2 className="text-xl font-black text-gray-900 group-hover:text-blue-700">{tile.title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{tile.description}</p>
              <span className="mt-4 text-sm font-black text-blue-700">Open Module →</span>
            </Link>
          ) : (
            <div key={tile.title} className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center opacity-75">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-5xl grayscale">{tile.icon}</div>
              <h2 className="text-xl font-black text-gray-700">{tile.title}</h2>
              <p className="mt-3 text-sm text-gray-500">Coming in next phase</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
