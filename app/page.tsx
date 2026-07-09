import Link from "next/link";

const tiles = [
  {
    title: "Stationery Bills",
    href: "/stationery-bills",
    icon: "📝",
  },
  {
    title: "IT Bills",
    href: "/it-bills",
    icon: "💻",
  },
  {
    title: "Internet Bills",
    href: "/internet-bills",
    icon: "🌐",
  },
  {
    title: "Printing Press",
    href: "/printing-press",
    icon: "🖨️",
  },
  {
    title: "Photostate",
    href: "/photostate",
    icon: "📄",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            Office Billing System
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Select bill category to continue
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {tiles.map((tile) => (
            <Link
              key={tile.title}
              href={tile.href}
              className="group flex min-h-[190px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-md transition-all duration-300 hover:-translate-y-2 hover:border-blue-500 hover:shadow-xl"
            >
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-5xl transition-all duration-300 group-hover:bg-blue-600 group-hover:scale-110">
                <span>{tile.icon}</span>
              </div>

              <h2 className="text-xl font-bold text-gray-800 transition-all duration-300 group-hover:text-blue-700">
                {tile.title}
              </h2>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}