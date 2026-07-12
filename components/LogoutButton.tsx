"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      window.location.href = "/admin/login";
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}
