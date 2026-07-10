import Link from "next/link";

const adminModules = [
  {
    title: "List of PS/Branches",
    description: "PS/Branches add, edit aur remove karne ke liye.",
    href: "/admin/stationery/branches",
    icon: "🏢",
  },
  {
    title: "Name of Stationery Items",
    description:
      "Stationery items, units aur minimum stock manage karne ke liye.",
    href: "/admin/stationery/items",
    icon: "📦",
  },
  {
    title: "Opening Stock Entry",
    description:
      "Already available stationery stock ko first time add/update karne ke liye.",
    href: "/admin/stationery/opening-stock",
    icon: "📥",
  },
];

export default function AdminDashboardPage() {
  return (
    <main className="min-h-screen bg-gray-100 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="mt-2 text-gray-600">
            Master data aur backend settings yahan manage hongi.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {adminModules.map((module) => (
            <Link
              key={module.title}
              href={module.href}
              className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl"
            >
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-4xl">
                {module.icon}
              </div>

              <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-700">
                {module.title}
              </h2>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                {module.description}
              </p>

              <div className="mt-6 text-sm font-bold text-blue-600">
                Open →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}