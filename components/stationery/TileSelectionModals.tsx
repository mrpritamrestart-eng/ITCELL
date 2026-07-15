"use client";

import { CSSProperties, ReactNode, useEffect, useMemo, useState } from "react";

export type TileOption = {
  id: string;
  label: string;
  secondary?: string;
};

type ModalShellProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  search: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
};

function ModalShell({
  open,
  title,
  subtitle,
  search,
  onSearchChange,
  onClose,
  children,
  footer,
}: ModalShellProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-2 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="border-b bg-gray-50 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-gray-900 sm:text-2xl">{title}</h2>
              {subtitle ? <p className="mt-1 text-sm text-gray-600">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-black text-gray-700 hover:bg-gray-100"
              aria-label="Close selection window"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="relative w-full max-w-sm">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
              <input
                autoFocus
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search name/code..."
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">{children}</div>
        <footer className="border-t bg-gray-50 px-4 py-3 sm:px-5">{footer}</footer>
      </div>
    </div>
  );
}

function gridStyle(columns: number): CSSProperties {
  return { "--selector-tile-columns": Math.min(Math.max(columns, 3), 10) } as CSSProperties;
}

function matches(option: TileOption, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return `${option.label} ${option.secondary || ""}`.toLowerCase().includes(query);
}

export function SingleSelectTileModal({
  open,
  title,
  subtitle,
  options,
  value,
  columns = 6,
  onClose,
  onApply,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  options: TileOption[];
  value: string;
  columns?: number;
  onClose: () => void;
  onApply: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setSearch("");
    }
  }, [open, value]);

  const filtered = useMemo(() => options.filter((option) => matches(option, search)), [options, search]);

  return (
    <ModalShell
      open={open}
      title={title}
      subtitle={subtitle}
      search={search}
      onSearchChange={setSearch}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-bold text-gray-600">Selected: {draft ? 1 : 0}</div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft("")} className="rounded-xl border px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-white">
              Clear
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-white">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                onClose();
              }}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700"
            >
              Apply Selection
            </button>
          </div>
        </div>
      }
    >
      <div className="selector-tile-grid" style={gridStyle(columns)}>
        {filtered.map((option) => {
          const selected = draft === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setDraft(option.id)}
              className={`min-h-16 rounded-xl border px-2 py-2 text-left transition ${
                selected
                  ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200"
                  : "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/40"
              }`}
            >
              <span className="block text-xs font-black leading-4 text-gray-900 sm:text-sm">{option.label}</span>
              {option.secondary ? <span className="mt-1 block text-[11px] font-semibold text-gray-500">{option.secondary}</span> : null}
            </button>
          );
        })}
      </div>
      {!filtered.length ? <div className="py-16 text-center font-semibold text-gray-500">No matching option found.</div> : null}
    </ModalShell>
  );
}

export function MultiSelectTileModal({
  open,
  title,
  subtitle,
  options,
  values,
  columns = 6,
  onClose,
  onApply,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  options: TileOption[];
  values: string[];
  columns?: number;
  onClose: () => void;
  onApply: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string[]>(values);

  useEffect(() => {
    if (open) {
      setDraft(values);
      setSearch("");
    }
  }, [open, values]);

  const filtered = useMemo(() => options.filter((option) => matches(option, search)), [options, search]);
  const draftSet = useMemo(() => new Set(draft), [draft]);

  function toggle(id: string) {
    setDraft((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  return (
    <ModalShell
      open={open}
      title={title}
      subtitle={subtitle}
      search={search}
      onSearchChange={setSearch}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-bold text-gray-600">Selected: {draft.length}</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDraft((current) => [...new Set([...current, ...filtered.map((option) => option.id)])])}
              className="rounded-xl border px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-white"
            >
              Select Visible
            </button>
            <button type="button" onClick={() => setDraft([])} className="rounded-xl border px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-white">
              Clear
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-white">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                onClose();
              }}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700"
            >
              Apply Selection
            </button>
          </div>
        </div>
      }
    >
      <div className="selector-tile-grid" style={gridStyle(columns)}>
        {filtered.map((option) => {
          const selected = draftSet.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              className={`min-h-16 rounded-xl border px-2 py-2 text-left transition ${
                selected
                  ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200"
                  : "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/40"
              }`}
            >
              <span className="block text-xs font-black leading-4 text-gray-900 sm:text-sm">{option.label}</span>
              {option.secondary ? <span className="mt-1 block text-[11px] font-semibold text-gray-500">{option.secondary}</span> : null}
            </button>
          );
        })}
      </div>
      {!filtered.length ? <div className="py-16 text-center font-semibold text-gray-500">No matching option found.</div> : null}
    </ModalShell>
  );
}

export function QuantityTileSelectorModal({
  open,
  title,
  subtitle,
  options,
  quantities,
  columns = 6,
  onClose,
  onApply,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  options: TileOption[];
  quantities: Record<string, number>;
  columns?: number;
  onClose: () => void;
  onApply: (quantities: Record<string, number>) => void;
}) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, number>>(quantities);

  useEffect(() => {
    if (open) {
      setDraft({ ...quantities });
      setSearch("");
    }
  }, [open, quantities]);

  const filtered = useMemo(() => options.filter((option) => matches(option, search)), [options, search]);
  const selectedCount = Object.values(draft).filter((value) => Number(value) > 0).length;
  const totalQuantity = Object.values(draft).reduce((sum, value) => sum + (Number(value) || 0), 0);

  function setQuantity(id: string, value: number) {
    setDraft((current) => {
      const next = { ...current };
      const normalized = Number.isFinite(value) ? Math.max(value, 0) : 0;
      if (normalized <= 0) delete next[id];
      else next[id] = normalized;
      return next;
    });
  }

  return (
    <ModalShell
      open={open}
      title={title}
      subtitle={subtitle}
      search={search}
      onSearchChange={setSearch}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-bold text-gray-600">
            Selected items: {selectedCount} <span className="mx-2 text-gray-300">|</span> Total quantity: {totalQuantity}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft({})} className="rounded-xl border px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-white">
              Clear All
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-white">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const clean = Object.fromEntries(Object.entries(draft).filter(([, value]) => Number(value) > 0));
                onApply(clean);
                onClose();
              }}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700"
            >
              Apply to Form
            </button>
          </div>
        </div>
      }
    >
      <div className="selector-tile-grid items-start" style={gridStyle(columns)}>
        {filtered.map((option) => {
          const quantity = Number(draft[option.id]) || 0;
          const selected = quantity > 0;
          return (
            <div key={option.id} className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  if (!selected) setQuantity(option.id, 1);
                }}
                className={`min-h-16 w-full rounded-xl border px-2 py-2 text-left transition ${
                  selected
                    ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200"
                    : "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/40"
                }`}
              >
                <span className="block text-xs font-black leading-4 text-gray-900 sm:text-sm">{option.label}</span>
                {option.secondary ? <span className="mt-1 block text-[11px] font-semibold text-gray-500">{option.secondary}</span> : null}
              </button>

              {selected ? (
                <div className="mt-1.5 grid grid-cols-[30px_minmax(42px,1fr)_30px] overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setQuantity(option.id, quantity - 1)}
                    className="flex h-8 items-center justify-center bg-red-50 text-lg font-black text-red-700 hover:bg-red-100"
                    aria-label={`Decrease ${option.label}`}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={quantity}
                    onChange={(event) => setQuantity(option.id, Number(event.target.value))}
                    className="h-8 min-w-0 border-x border-blue-100 px-1 text-center text-sm font-black outline-none focus:bg-blue-50"
                    aria-label={`${option.label} quantity`}
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(option.id, quantity + 1)}
                    className="flex h-8 items-center justify-center bg-green-50 text-lg font-black text-green-700 hover:bg-green-100"
                    aria-label={`Increase ${option.label}`}
                  >
                    +
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {!filtered.length ? <div className="py-16 text-center font-semibold text-gray-500">No matching item found.</div> : null}
    </ModalShell>
  );
}
