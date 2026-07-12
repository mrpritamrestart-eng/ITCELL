"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const login = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Login failed");
      }

      const requestedPath = new URLSearchParams(window.location.search).get("next");
      router.push(requestedPath?.startsWith("/") ? requestedPath : "/admin");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Login failed"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Admin Login</h1>
          <p className="mt-2 text-gray-600">
            IT Cell Billing System Admin Panel
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-700">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter username"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="button"
            onClick={login}
            disabled={isLoading}
            className="w-full rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </div>
      </div>
    </main>
  );
}