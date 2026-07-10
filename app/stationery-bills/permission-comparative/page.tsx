import Link from "next/link";

const sections = [
  {
    number: "01",
    title: "Permissions",
    description:
      "Monthly PS/Branch out records ko editable permission tables me convert, adjust, split aur save karein.",
    href: "/stationery-bills/permission-comparative/permissions",
    icon: "📝",
  },
  {
    number: "02",
    title: "Bill Amount Calculations",
    description:
      "Single ya multiple permission records select karke firm-wise unit price aur total amount calculate karein.",
    href: "/stationery-bills/permission-comparative/bill-calculations",
    icon: "🧮",
  },
  {
    number: "03",
    title: "Comparative Quotation and Member Performa",
    description:
      "Saved invoice se two-page Comparative Quotation aur Committee Survey Report PDF download karein.",
    href: "/stationery-bills/permission-comparative/comparative-performa",
    icon: "📄",
  },
];

export default function PermissionComparativePage() {
  return (
    <main className="min-h-screen bg-gray-100 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/stationery-bills"
              className="mb-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Back to Stationery Bills
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              Permission and Comparative Quotations
            </h1>
            <p className="mt-2 max-w-3xl text-gray-600">
              Permission preparation se lekar bill comparison aur final two-page
              PDF tak ka complete workflow.
            </p>
          </div>

          <Link
            href="/stationery-bills/permission-comparative/firms"
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-black"
          >
            + Add Firms
          </Link>
        </div>

        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-bold text-amber-950">Workflow</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Out Record → Editable Permission → Firm-wise Amount Calculation →
            Comparative Quotation & Member Performa PDF
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {sections.map((section) => (
            <Link
              key={section.number}
              href={section.href}
              className="group flex min-h-[300px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-4xl group-hover:bg-blue-600">
                    {section.icon}
                  </div>
                  <span className="text-4xl font-black text-gray-100 group-hover:text-blue-100">
                    {section.number}
                  </span>
                </div>
                <h2 className="mt-7 text-xl font-bold text-gray-900 group-hover:text-blue-700">
                  {section.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  {section.description}
                </p>
              </div>
              <div className="mt-8 text-sm font-bold text-blue-600">
                Open Section →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
