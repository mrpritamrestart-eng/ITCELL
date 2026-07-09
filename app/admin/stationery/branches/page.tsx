"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Branch = {
  _id: string;
  name: string;
  code: string;
};

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [searchText, setSearchText] = useState("");

  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [editingCode, setEditingCode] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fetchBranches = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/stationery/branches");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Branches load nahi ho payi");
      }

      setBranches(data.branches || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Branches load nahi ho payi"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const filteredBranches = useMemo(() => {
    const search = searchText.toLowerCase();

    return branches.filter(
      (branch) =>
        branch.name.toLowerCase().includes(search) ||
        branch.code.toLowerCase().includes(search)
    );
  }, [branches, searchText]);

  const addBranch = async () => {
    try {
      setIsSaving(true);
      setSuccessMessage("");
      setErrorMessage("");

      if (!branchName.trim()) {
        throw new Error("PS/Branch name enter karo");
      }

      const response = await fetch("/api/stationery/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: branchName,
          code: branchCode,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Branch add nahi ho payi");
      }

      setSuccessMessage("PS/Branch successfully add ho gayi");
      setBranchName("");
      setBranchCode("");
      await fetchBranches();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Branch add nahi ho payi"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (branch: Branch) => {
    setEditingId(branch._id);
    setEditingName(branch.name);
    setEditingCode(branch.code);
    setSuccessMessage("");
    setErrorMessage("");
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditingName("");
    setEditingCode("");
  };

  const updateBranch = async () => {
    try {
      setIsSaving(true);
      setSuccessMessage("");
      setErrorMessage("");

      if (!editingName.trim()) {
        throw new Error("PS/Branch name enter karo");
      }

      if (!editingCode.trim()) {
        throw new Error("Branch code enter karo");
      }

      const response = await fetch("/api/stationery/branches", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingId,
          name: editingName,
          code: editingCode,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Branch update nahi ho payi");
      }

      setSuccessMessage("PS/Branch successfully update ho gayi");
      setEditingId("");
      setEditingName("");
      setEditingCode("");
      await fetchBranches();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Branch update nahi ho payi"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const removeBranch = async (branch: Branch) => {
    const confirmed = window.confirm(
      `${branch.name} ko list se remove karna hai? Old entries safe rahengi.`
    );

    if (!confirmed) return;

    try {
      setIsSaving(true);
      setSuccessMessage("");
      setErrorMessage("");

      const response = await fetch("/api/stationery/branches", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: branch._id,
          action: "delete",
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Branch remove nahi ho payi");
      }

      setSuccessMessage("PS/Branch list se remove ho gayi");
      await fetchBranches();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Branch remove nahi ho payi"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/admin"
              className="mb-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Back to Admin Panel
            </Link>

            <h1 className="text-3xl font-bold text-gray-900">
              List of PS/Branches
            </h1>

            <p className="mt-2 text-gray-600">
              Yahan jo PS/Branch add hogi, wahi Stationery Out Entry ke
              dropdown me show hogi.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-6 py-4 text-right shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Branches</p>
            <p className="text-2xl font-bold text-blue-700">
              {branches.length}
            </p>
          </div>
        </div>

        {successMessage && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-bold text-green-800">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
            {errorMessage}
          </div>
        )}

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-gray-900">
            Add New PS/Branch
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_260px_auto]">
            <input
              type="text"
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
              placeholder="Enter PS/Branch name"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <input
              type="text"
              value={branchCode}
              onChange={(event) => setBranchCode(event.target.value)}
              placeholder="Branch code, e.g. BR-001"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <button
              type="button"
              onClick={addBranch}
              disabled={isSaving}
              className="rounded-xl bg-green-600 px-6 py-3 font-bold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSaving ? "Saving..." : "Add Branch"}
            </button>
          </div>

          <p className="mt-3 text-sm font-medium text-gray-500">
            Branch code blank chhodne par system automatic code generate karega.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                PS/Branch List
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Active branches only.
              </p>
            </div>

            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search branch/code..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-80"
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[900px] border-collapse bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Sr.
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    Branch Code
                  </th>
                  <th className="border-b px-4 py-4 text-left text-sm font-bold text-gray-700">
                    PS/Branch Name
                  </th>
                  <th className="border-b px-4 py-4 text-center text-sm font-bold text-gray-700">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm font-semibold text-gray-500"
                    >
                      Branches loading...
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  filteredBranches.map((branch, index) => (
                    <tr key={branch._id} className="hover:bg-gray-50">
                      <td className="border-b px-4 py-4 text-sm font-semibold text-gray-700">
                        {index + 1}
                      </td>

                      <td className="border-b px-4 py-4">
                        {editingId === branch._id ? (
                          <input
                            type="text"
                            value={editingCode}
                            onChange={(event) =>
                              setEditingCode(event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-700">
                            {branch.code}
                          </span>
                        )}
                      </td>

                      <td className="border-b px-4 py-4">
                        {editingId === branch._id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(event) =>
                              setEditingName(event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-900">
                            {branch.name}
                          </span>
                        )}
                      </td>

                      <td className="border-b px-4 py-4 text-center">
                        {editingId === branch._id ? (
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={updateBranch}
                              disabled={isSaving}
                              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:bg-gray-300"
                            >
                              Save
                            </button>

                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(branch)}
                              className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => removeBranch(branch)}
                              className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-100"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}

                {!isLoading && filteredBranches.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm font-semibold text-gray-500"
                    >
                      No branch found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-medium text-blue-900">
            Note: Branch code aur branch name dono edit ho sakte hain. Remove
            karne se old entries delete nahi hongi.
          </div>
        </div>
      </div>
    </main>
  );
}