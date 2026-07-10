"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Firm = {
  _id: string;
  name: string;
};

type FirmPreference = {
  firstFirmId: string;
  secondFirmId: string;
  thirdFirmId: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  firms?: Firm[];
  preference?: FirmPreference;
};

const emptyFirmOrder = [
  "",
  "",
  "",
];

function positionName(index: number) {
  if (index === 0) {
    return "First Firm";
  }

  if (index === 1) {
    return "Second Firm";
  }

  return "Third Firm";
}

export default function FirmsPage() {
  const [firms, setFirms] =
    useState<Firm[]>([]);

  const [name, setName] =
    useState("");

  const [
    editingId,
    setEditingId,
  ] = useState("");

  const [
    editingName,
    setEditingName,
  ] = useState("");

  const [
    defaultFirmIds,
    setDefaultFirmIds,
  ] = useState<string[]>(
    emptyFirmOrder
  );

  const [message, setMessage] =
    useState("");

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    isPreferenceSaving,
    setIsPreferenceSaving,
  ] = useState(false);

  const loadPageData =
    useCallback(async () => {
      setIsLoading(true);

      try {
        const [
          firmsResponse,
          preferenceResponse,
        ] = await Promise.all([
          fetch(
            "/api/stationery/firms",
            {
              cache: "no-store",
            }
          ),

          fetch(
            "/api/stationery/firm-preferences",
            {
              cache: "no-store",
            }
          ),
        ]);

        const firmsData =
          (await firmsResponse.json()) as ApiResponse;

        const preferenceData =
          (await preferenceResponse.json()) as ApiResponse;

        if (
          !firmsResponse.ok ||
          !firmsData.success
        ) {
          throw new Error(
            firmsData.message ||
              "Firms load nahi ho payi"
          );
        }

        if (
          !preferenceResponse.ok ||
          !preferenceData.success
        ) {
          throw new Error(
            preferenceData.message ||
              "Default Firm Order load nahi ho paya"
          );
        }

        setFirms(
          firmsData.firms || []
        );

        setDefaultFirmIds([
          preferenceData.preference
            ?.firstFirmId || "",

          preferenceData.preference
            ?.secondFirmId || "",

          preferenceData.preference
            ?.thirdFirmId || "",
        ]);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Firm data load nahi ho paya"
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const hasCompleteDefaultOrder =
    defaultFirmIds.every(Boolean) &&
    new Set(defaultFirmIds).size ===
      3;

  const selectedDefaultFirms =
    useMemo(
      () =>
        defaultFirmIds.map(
          (firmId) =>
            firms.find(
              (firm) =>
                firm._id === firmId
            ) || null
        ),
      [defaultFirmIds, firms]
    );

  function assignedPosition(
    firmId: string
  ) {
    const index =
      defaultFirmIds.indexOf(
        firmId
      );

    if (index < 0) {
      return "";
    }

    return positionName(index);
  }

  function updateDefaultFirm(
    index: number,
    firmId: string
  ) {
    if (
      firmId &&
      defaultFirmIds.some(
        (currentFirmId, currentIndex) =>
          currentIndex !== index &&
          currentFirmId === firmId
      )
    ) {
      setMessage(
        "Ek hi firm ko do positions par assign nahi kiya ja sakta."
      );

      return;
    }

    setMessage("");

    setDefaultFirmIds(
      (current) =>
        current.map(
          (currentFirmId, currentIndex) =>
            currentIndex === index
              ? firmId
              : currentFirmId
        )
    );
  }

  async function saveDefaultOrder() {
    setIsPreferenceSaving(true);
    setMessage("");

    try {
      if (
        defaultFirmIds.some(
          (firmId) => !firmId
        )
      ) {
        throw new Error(
          "First Firm, Second Firm aur Third Firm teeno select karein"
        );
      }

      if (
        new Set(defaultFirmIds)
          .size !== 3
      ) {
        throw new Error(
          "Teen alag-alag firms select karein"
        );
      }

      const response = await fetch(
        "/api/stationery/firm-preferences",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            firstFirmId:
              defaultFirmIds[0],

            secondFirmId:
              defaultFirmIds[1],

            thirdFirmId:
              defaultFirmIds[2],
          }),
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Default Firm Order save nahi ho paya"
        );
      }

      setMessage(
        data.message ||
          "Default Firm Order save ho gaya"
      );

      await loadPageData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Default Firm Order save nahi ho paya"
      );
    } finally {
      setIsPreferenceSaving(false);
    }
  }

  async function clearDefaultOrder() {
    if (
      !window.confirm(
        "Saved Default Firm Order clear karna hai?"
      )
    ) {
      return;
    }

    setIsPreferenceSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/stationery/firm-preferences",
        {
          method: "DELETE",
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Default Firm Order clear nahi ho paya"
        );
      }

      setDefaultFirmIds([
        "",
        "",
        "",
      ]);

      setMessage(
        data.message ||
          "Default Firm Order clear ho gaya"
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Default Firm Order clear nahi ho paya"
      );
    } finally {
      setIsPreferenceSaving(false);
    }
  }

  async function addFirm(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/stationery/firms",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            name,
          }),
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Firm save nahi ho payi"
        );
      }

      setName("");

      setMessage(
        data.message ||
          "Firm add ho gayi"
      );

      await loadPageData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Firm save nahi ho payi"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function updateFirm(
    id: string
  ) {
    if (!editingName.trim()) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/stationery/firms",
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            id,
            name: editingName,
          }),
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Firm update nahi ho payi"
        );
      }

      setEditingId("");
      setEditingName("");

      setMessage(
        data.message ||
          "Firm update ho gayi"
      );

      await loadPageData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Firm update nahi ho payi"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function removeFirm(
    id: string,
    firmName: string
  ) {
    const assigned =
      assignedPosition(id);

    if (assigned) {
      setMessage(
        `"${firmName}" ${assigned} ke roop me assigned hai. Pehle Default Firm Order change ya clear karein.`
      );

      return;
    }

    const confirmed =
      window.confirm(
        `"${firmName}" ko list se remove karna hai?`
      );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/stationery/firms",
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            id,
            action: "delete",
          }),
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Firm remove nahi ho payi"
        );
      }

      setMessage(
        data.message ||
          "Firm remove ho gayi"
      );

      await loadPageData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Firm remove nahi ho payi"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link
            href="/stationery-bills/permission-comparative"
            className="mb-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            ← Back to Permission and Comparative
            Quotations
          </Link>

          <h1 className="text-3xl font-bold text-gray-900">
            Add Firms and Default Firm Order
          </h1>

          <p className="mt-2 max-w-4xl text-gray-600">
            Firms add karein aur current billing
            batch ke liye First, Second aur Third
            Firm ka default order assign karein.
            New Bill Calculations me ye order
            automatically select ho jayega.
          </p>
        </div>

        {message && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-900">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
          <div className="space-y-6">
            <form
              onSubmit={addFirm}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-bold text-gray-900">
                New Firm
              </h2>

              <label className="mt-5 block text-sm font-bold text-gray-700">
                Firm Name
              </label>

              <input
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
                placeholder="Example: XYZ PVT LTD"
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <button
                type="submit"
                disabled={
                  isSaving ||
                  !name.trim()
                }
                className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? "Saving..."
                  : "+ Add Firm"}
              </button>
            </form>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Default Firm Order
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    Naye bills me firms isi order
                    me automatic select hongi.
                  </p>
                </div>

                {hasCompleteDefaultOrder && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-800">
                    Active
                  </span>
                )}
              </div>

              {firms.length < 3 && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
                  Default order set karne ke liye
                  kam se kam 3 active firms add
                  karein.
                </div>
              )}

              <div className="mt-5 space-y-4">
                {[0, 1, 2].map(
                  (index) => (
                    <div key={index}>
                      <label className="block text-sm font-bold text-gray-700">
                        {positionName(
                          index
                        )}
                      </label>

                      <select
                        value={
                          defaultFirmIds[
                            index
                          ]
                        }
                        onChange={(
                          event
                        ) =>
                          updateDefaultFirm(
                            index,
                            event.target
                              .value
                          )
                        }
                        disabled={
                          firms.length <
                          3
                        }
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-amber-500 disabled:bg-gray-100"
                      >
                        <option value="">
                          Select{" "}
                          {positionName(
                            index
                          )}
                        </option>

                        {firms.map(
                          (firm) => (
                            <option
                              key={
                                firm._id
                              }
                              value={
                                firm._id
                              }
                              disabled={defaultFirmIds.some(
                                (
                                  firmId,
                                  firmIndex
                                ) =>
                                  firmIndex !==
                                    index &&
                                  firmId ===
                                    firm._id
                              )}
                            >
                              {
                                firm.name
                              }
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  void saveDefaultOrder()
                }
                disabled={
                  isPreferenceSaving ||
                  firms.length < 3 ||
                  defaultFirmIds.some(
                    (firmId) =>
                      !firmId
                  )
                }
                className="mt-6 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPreferenceSaving
                  ? "Saving Order..."
                  : "Save Default Firm Order"}
              </button>

              <button
                type="button"
                onClick={() =>
                  void clearDefaultOrder()
                }
                disabled={
                  isPreferenceSaving ||
                  !defaultFirmIds.some(
                    Boolean
                  )
                }
                className="mt-3 w-full rounded-xl border border-red-300 bg-white px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear Default Order
              </button>

              {hasCompleteDefaultOrder && (
                <div className="mt-5 rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-gray-500">
                    Current Billing Order
                  </p>

                  <div className="mt-3 space-y-2">
                    {selectedDefaultFirms.map(
                      (
                        firm,
                        index
                      ) => (
                        <div
                          key={
                            index
                          }
                          className="flex items-center gap-3 rounded-lg bg-white px-3 py-2"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-800">
                            {index + 1}
                          </span>

                          <span className="text-sm font-bold text-gray-900">
                            {firm?.name ||
                              "Not Selected"}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>

          <section className="h-fit rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Saved Firms
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Total: {firms.length}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadPageData()
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200">
              {isLoading ? (
                <div className="p-8 text-center text-sm font-semibold text-gray-500">
                  Firms loading...
                </div>
              ) : firms.length === 0 ? (
                <div className="p-8 text-center text-sm font-semibold text-gray-500">
                  Abhi koi firm add nahi hai.
                </div>
              ) : (
                firms.map(
                  (firm, index) => {
                    const assigned =
                      assignedPosition(
                        firm._id
                      );

                    return (
                      <div
                        key={firm._id}
                        className="flex flex-col gap-3 border-b border-gray-200 p-4 last:border-b-0 sm:flex-row sm:items-center"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                          {index + 1}
                        </span>

                        {editingId ===
                        firm._id ? (
                          <input
                            value={
                              editingName
                            }
                            onChange={(
                              event
                            ) =>
                              setEditingName(
                                event.target
                                  .value
                              )
                            }
                            className="min-w-0 flex-1 rounded-lg border border-blue-400 px-3 py-2 text-sm font-semibold text-gray-900 outline-none"
                            autoFocus
                          />
                        ) : (
                          <div className="min-w-0 flex-1">
                            <p className="break-words font-bold text-gray-900">
                              {
                                firm.name
                              }
                            </p>

                            {assigned && (
                              <span className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-800">
                                {assigned}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2">
                          {editingId ===
                          firm._id ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void updateFirm(
                                    firm._id
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                Save
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(
                                    ""
                                  );

                                  setEditingName(
                                    ""
                                  );
                                }}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(
                                    firm._id
                                  );

                                  setEditingName(
                                    firm.name
                                  );
                                }}
                                className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void removeFirm(
                                    firm._id,
                                    firm.name
                                  )
                                }
                                disabled={
                                  isSaving ||
                                  Boolean(
                                    assigned
                                  )
                                }
                                title={
                                  assigned
                                    ? "Pehle Default Firm Order change ya clear karein"
                                    : "Remove Firm"
                                }
                                className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }
                )
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}