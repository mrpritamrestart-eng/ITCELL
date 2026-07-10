import Link from "next/link";

const modules = [
  {
    title: "Stationery Purchase Entry",
    description: "Shop se bulk me liye gaye stationery items ki entry.",
    href: "/stationery-bills/purchase-entry",
    icon: "🛒",
  },
  {
    title: "Current Stock",
    description: "Available stationery items aur unki current quantity.",
    href: "/stationery-bills/current-stock",
    icon: "📦",
  },
  {
    title: "Stationery Out Entry",
    description: "PS/Branch ko diye gaye stationery items ki manual entry.",
    href: "/stationery-bills/out-entry",
    icon: "📤",
  },
  {
    title: "Monthly Branch Report",
    description: "Month-wise PS/Branch rows aur item columns wali table.",
    href: "/stationery-bills/monthly-report",
    icon: "📊",
  },
  {
    title: "Branch-wise Monthly Data",
    description: "Ek ya multiple PS/Branches ka monthly stationery out data.",
    href: "/stationery-bills/branch-wise-report",
    icon: "🏢",
  },
  {
    title: "Permission and Comparative Quotations",
    description:
      "Branch permissions, bill amount calculations aur comparative quotation PDF.",
    href: "/stationery-bills/permission-comparative",
    icon: "📑",
    placement: "bottom-right",
  },
];

export default function StationeryBillsPage() {
  return (
    <main className="min-h-screen bg-gray-100 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/"
              className="mb-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Back to Home
            </Link>

            <h1 className="text-3xl font-bold text-gray-900">
              Stationery Bills
            </h1>

            <p className="mt-2 max-w-3xl text-gray-600">
              Stationery purchase, stock, branch-wise out entry aur monthly
              reports manage karne ke liye dashboard.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-5 py-4 text-right shadow-sm">
            <p className="text-sm text-gray-500">Current Month</p>
            <p className="text-xl font-bold text-gray-900">
              Stationery Records
            </p>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="mb-3 text-lg font-bold text-blue-900">
            Stationery Work Flow
          </h2>

          <div className="grid grid-cols-1 gap-3 text-sm font-medium text-blue-900 md:grid-cols-4">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              1. Shop se stationery purchase
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              2. Stock me automatic add
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              3. PS/Branch ko item issue
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              4. Stock se automatic minus
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
          {modules.map((module) => (
            <Link
              key={module.title}
              href={module.href}
              className={`group flex min-h-[230px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl ${
                "placement" in module && module.placement === "bottom-right"
                  ? "xl:col-start-5"
                  : ""
              }`}
            >
              <div>
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-4xl transition-all duration-300 group-hover:bg-blue-600 group-hover:scale-105">
                  <span>{module.icon}</span>
                </div>

                <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-700">
                  {module.title}
                </h2>

                <p className="mt-3 text-sm leading-6 text-gray-600">
                  {module.description}
                </p>
              </div>

              <div className="mt-6 text-sm font-bold text-blue-600">
                Open Section →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}