import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

export default function AppHeader() {
  return (
    <header className="border-b border-gray-200 bg-white px-5 py-3 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" className="font-extrabold text-gray-900">Office Billing System</Link>
          <Link href="/stationery-bills" className="text-sm font-semibold text-blue-700 hover:text-blue-900">Stationery</Link>
          <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:text-blue-900">Admin</Link>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
