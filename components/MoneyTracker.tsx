"use client";

import { FormEvent, useMemo, useState } from "react";
import ui from "./MobileBusiness.module.css";
import {
  STORAGE_KEYS,
  formatCurrency,
  formatDisplayDate,
  makeId,
  todayIso,
  type MoneyEntry,
} from "@/lib/business-data";
import { useStoredList } from "@/lib/useStoredList";

type TrackerType = "expense" | "income";
type ViewFilter = "Today" | "Month" | "All";
type IncomeMode = MoneyEntry["mode"];
type MoneyEntryWithShop = MoneyEntry & {
  shop?: string;
};

const shops = [
  "Karuvannur",
  "Ollur",
  "Kachery",
  "Mulayam Rd",
  "Pattikkad",
] as const;

function makeForm(type: TrackerType) {
  return {
    date: todayIso(),
    details: "",
    amount: "",
    mode: (type === "income" ? "GPay" : "") as IncomeMode,
    shop: type === "income" ? shops[0] : "",
    notes: "",
  };
}

export default function MoneyTracker({ type }: { type: TrackerType }) {
  const isExpense = type === "expense";
  const storageKey = isExpense ? STORAGE_KEYS.expenses : STORAGE_KEYS.income;
  const { items, setItems } = useStoredList<MoneyEntryWithShop>(storageKey);

  const [form, setForm] = useState(() => makeForm(type));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ViewFilter>("Month");
  const [search, setSearch] = useState("");

  const today = todayIso();
  const month = today.slice(0, 7);

  const todayTotal = useMemo(
    () =>
      items
        .filter((item) => item.date === today)
        .reduce((sum, item) => sum + item.amount, 0),
    [items, today]
  );

  const monthTotal = useMemo(
    () =>
      items
        .filter((item) => item.date.startsWith(month))
        .reduce((sum, item) => sum + item.amount, 0),
    [items, month]
  );

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...items]
      .filter((item) => {
        if (filter === "Today") return item.date === today;
        if (filter === "Month") return item.date.startsWith(month);
        return true;
      })
      .filter((item) => {
        if (!query) return true;

        return `${item.details} ${item.shop || ""} ${item.mode} ${item.notes} ${
          item.date
        } ${item.amount}`
          .toLowerCase()
          .includes(query);
      })
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.createdAt - a.createdAt
      );
  }, [filter, items, month, search, today]);

  function save(event: FormEvent) {
    event.preventDefault();

    const amount = Number(form.amount);

    if (!form.date || !Number.isFinite(amount) || amount <= 0) return;
    if (isExpense && !form.details.trim()) return;
    if (!isExpense && !form.shop) return;

    if (editingId) {
      setItems((current) =>
        current.map((item) =>
          item.id === editingId
            ? {
                ...item,
                date: form.date,
                details: isExpense ? form.details.trim() : "",
                amount,
                mode: isExpense ? "" : form.mode,
                shop: isExpense ? "" : form.shop,
                notes: form.notes.trim(),
                updatedAt: Date.now(),
              }
            : item
        )
      );
    } else {
      const now = Date.now();

      setItems((current) => [
        {
          id: makeId(type),
          date: form.date,
          details: isExpense ? form.details.trim() : "",
          amount,
          mode: isExpense ? "" : form.mode,
          shop: isExpense ? "" : form.shop,
          notes: form.notes.trim(),
          createdAt: now,
          updatedAt: now,
        },
        ...current,
      ]);
    }

    setEditingId(null);
    setForm(makeForm(type));
  }

  function startEdit(item: MoneyEntryWithShop) {
    setEditingId(item.id);
    setForm({
      date: item.date,
      details: item.details,
      amount: String(item.amount),
      mode: isExpense ? "" : item.mode || "GPay",
      shop: isExpense ? "" : item.shop || shops[0],
      notes: item.notes,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(makeForm(type));
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));

    if (editingId === id) cancelEdit();
  }

  function entryText(item: MoneyEntryWithShop) {
    const mainText = isExpense
      ? item.details || "Expense"
      : `${item.shop || "Shop"} • ${item.mode || "Income"}`;

    const noteText = item.notes ? ` • ${item.notes}` : "";

    return `${mainText} • ${formatDisplayDate(item.date)}${noteText}`;
  }

  return (
    <div className={`${ui.screen} money-tracker-compact`}>
      <div className={`${ui.summaryRow} mt-summary-row`}>
        <div className={`${ui.summaryCard} mt-summary-card`}>
          <div className={`${ui.summaryLabel} mt-summary-label`}>Today</div>
          <div className={`${ui.summaryValue} mt-summary-value`}>
            {formatCurrency(todayTotal)}
          </div>
        </div>

        <div className={`${ui.summaryCard} mt-summary-card`}>
          <div className={`${ui.summaryLabel} mt-summary-label`}>
            This Month
          </div>
          <div className={`${ui.summaryValue} mt-summary-value`}>
            {formatCurrency(monthTotal)}
          </div>
        </div>
      </div>

      <form
        className={`${ui.panel} ${ui.composer} mt-composer`}
        onSubmit={save}
      >
        <div className={`${ui.formStack} mt-form-stack`}>
          {isExpense ? (
            <div className="mt-field-group">
              <label className={`${ui.label} mt-label`}>
                Expense Details
              </label>
              <input
                className={`${ui.field} mt-field`}
                value={form.details}
                onChange={(event) =>
                  setForm({ ...form, details: event.target.value })
                }
                placeholder="What was the expense?"
                required
              />
            </div>
          ) : (
            <>
              <div className="mt-field-group">
                <label className={`${ui.label} mt-label`}>Shop</label>
                <select
                  className={`${ui.select} mt-field`}
                  value={form.shop}
                  onChange={(event) =>
                    setForm({ ...form, shop: event.target.value })
                  }
                  required
                >
                  {shops.map((shop) => (
                    <option key={shop} value={shop}>
                      {shop}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-field-group">
                <label className={`${ui.label} mt-label`}>Mode</label>

                <div className={`${ui.modeButtons} mt-mode-buttons`}>
                  {(["GPay", "Cash", "Staff Collection"] as const).map(
                    (mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`${ui.modeButton} mt-mode-button ${
                          form.mode === mode ? ui.modeButtonActive : ""
                        }`}
                        onClick={() => setForm({ ...form, mode })}
                      >
                        {mode === "GPay"
                          ? "📱 GPay"
                          : mode === "Cash"
                            ? "💵 Cash"
                            : "👤 Staff"}
                      </button>
                    )
                  )}
                </div>
              </div>
            </>
          )}

          <div className="mt-field-group">
            <label className={`${ui.label} mt-label`}>Amount</label>
            <input
              className={`${ui.amountInput} mt-amount-input`}
              type="number"
              min="1"
              step="1"
              inputMode="decimal"
              value={form.amount}
              onChange={(event) =>
                setForm({ ...form, amount: event.target.value })
              }
              placeholder="₹ 0"
              required
            />
          </div>

          <div className="mt-field-group">
            <label className={`${ui.label} mt-label`}>Notes</label>
            <textarea
              className={`${ui.textarea} mt-textarea`}
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
              placeholder="Optional notes"
            />
          </div>

          <div className="mt-field-group">
            <label className={`${ui.label} mt-label`}>Date</label>

            <div className={`${ui.dateToggleRow} mt-date-row`}>
              <button
                type="button"
                className={`${ui.filterButton} mt-control-button ${
                  form.date === today ? ui.filterButtonActive : ""
                }`}
                onClick={() => setForm({ ...form, date: today })}
              >
                Today
              </button>

              <input
                className={`${ui.dateInput} mt-date-input`}
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm({ ...form, date: event.target.value })
                }
              />
            </div>
          </div>
        </div>

        <div className={`${ui.composerTools} mt-composer-tools`}>
          <div />

          <div className={`${ui.actionGroup} mt-action-group`}>
            {editingId ? (
              <button
                type="button"
                className={`${ui.secondaryButton} mt-control-button`}
                onClick={cancelEdit}
              >
                Cancel
              </button>
            ) : null}

            <button
              type="submit"
              className={`${ui.primaryButton} mt-control-button`}
            >
              {editingId
                ? "Update"
                : `Save ${isExpense ? "Expense" : "Income"}`}
            </button>
          </div>
        </div>
      </form>

      <div className={`${ui.sectionBar} mt-section-bar`}>
        <div className={`${ui.filterButtons} mt-filter-buttons`}>
          {(["Today", "Month", "All"] as const).map((name) => (
            <button
              key={name}
              type="button"
              className={`${ui.filterButton} mt-filter-button ${
                filter === name ? ui.filterButtonActive : ""
              }`}
              onClick={() => setFilter(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <input
          className={`${ui.searchInput} mt-search-input`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${isExpense ? "expenses" : "income"}`}
        />
      </div>

      {visibleItems.length === 0 ? (
        <div className={`${ui.empty} mt-empty`}>
          No {type} entries in this view.
        </div>
      ) : (
        <div className="mt-entry-list">
          {visibleItems.map((item) => (
            <article className="mt-entry-row" key={item.id}>
              <div className="mt-entry-text" title={entryText(item)}>
                {entryText(item)}
              </div>

              <div
                className={`mt-entry-amount ${
                  !isExpense ? "mt-entry-income" : ""
                }`}
              >
                {formatCurrency(item.amount)}
              </div>

              <button
                type="button"
                className="mt-entry-action"
                onClick={() => startEdit(item)}
                aria-label="Edit"
                title="Edit"
              >
                Edit
              </button>

              <button
                type="button"
                className="mt-entry-delete"
                onClick={() => remove(item.id)}
                aria-label="Delete"
                title="Delete"
              >
                Delete
              </button>
            </article>
          ))}
        </div>
      )}

      <style jsx global>{`
        .money-tracker-compact {
          font-weight: 600;
          font-size: 13.2px;
        }

        .money-tracker-compact input,
        .money-tracker-compact textarea,
        .money-tracker-compact select,
        .money-tracker-compact button {
          font-weight: 650 !important;
        }

        .money-tracker-compact .mt-entry-text,
        .money-tracker-compact .mt-entry-amount,
        .money-tracker-compact .mt-summary-label,
        .money-tracker-compact .mt-summary-value,
        .money-tracker-compact .mt-label {
          font-weight: 700 !important;
        }

        .money-tracker-compact .mt-summary-row {
          gap: 6px !important;
          margin-bottom: 7px !important;
        }

        .money-tracker-compact .mt-summary-card {
          min-height: 54px !important;
          padding: 7px 9px !important;
          border-radius: 8px !important;
          box-shadow: none !important;
        }

        .money-tracker-compact .mt-summary-label {
          font-size: 9.6px !important;
          line-height: 1 !important;
        }

        .money-tracker-compact .mt-summary-value {
          margin-top: 3px !important;
          font-size: 22.8px !important;
          line-height: 1 !important;
        }

        .money-tracker-compact .mt-composer {
          padding: 8px !important;
          border-radius: 9px !important;
          box-shadow: none !important;
        }

        .money-tracker-compact .mt-form-stack {
          gap: 6px !important;
        }

        .money-tracker-compact .mt-field-group {
          min-width: 0;
        }

        .money-tracker-compact .mt-label {
          margin-bottom: 3px !important;
          font-size: 10.8px !important;
          line-height: 1.1 !important;
        }

        .money-tracker-compact .mt-field,
        .money-tracker-compact .mt-date-input {
          min-height: 32px !important;
          height: 32px !important;
          border-radius: 7px !important;
          padding: 0 8px !important;
          font-size: 13.2px !important;
        }

        .money-tracker-compact .mt-textarea {
          min-height: 42px !important;
          height: 42px !important;
          resize: none !important;
          border-radius: 7px !important;
          padding: 7px 8px !important;
          font-size: 13.2px !important;
          line-height: 1.2 !important;
        }

        .money-tracker-compact .mt-amount-input {
          min-height: 38px !important;
          height: 38px !important;
          border-radius: 7px !important;
          padding: 0 9px !important;
          font-size: 24px !important;
        }

        .money-tracker-compact .mt-mode-buttons {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 4px !important;
        }

        .money-tracker-compact .mt-mode-button {
          min-height: 32px !important;
          height: 32px !important;
          border-radius: 7px !important;
          padding: 0 4px !important;
          font-size: 10.8px !important;
          white-space: nowrap !important;
        }

        .money-tracker-compact .mt-date-row {
          gap: 5px !important;
        }

        .money-tracker-compact .mt-control-button {
          min-height: 32px !important;
          height: 32px !important;
          border-radius: 7px !important;
          padding: 0 10px !important;
          font-size: 12px !important;
        }

        .money-tracker-compact .mt-composer-tools {
          margin-top: 7px !important;
        }

        .money-tracker-compact .mt-action-group {
          gap: 5px !important;
        }

        .money-tracker-compact .mt-section-bar {
          display: grid !important;
          grid-template-columns: auto minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 6px !important;
          margin: 8px 0 4px !important;
        }

        .money-tracker-compact .mt-filter-buttons {
          display: flex !important;
          flex-wrap: nowrap !important;
          gap: 3px !important;
        }

        .money-tracker-compact .mt-filter-button {
          min-height: 30px !important;
          height: 30px !important;
          border-radius: 6px !important;
          padding: 0 7px !important;
          font-size: 10.8px !important;
        }

        .money-tracker-compact .mt-search-input {
          width: 100% !important;
          min-height: 30px !important;
          height: 30px !important;
          border-radius: 6px !important;
          padding: 0 7px !important;
          font-size: 12px !important;
        }

        .money-tracker-compact .mt-empty {
          padding: 14px 6px !important;
          font-size: 12px !important;
        }

        .money-tracker-compact .mt-entry-list {
          border-top: 1px solid #d1d5db;
          background: #ffffff;
        }

        .money-tracker-compact .mt-entry-row {
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto auto;
          align-items: center;
          gap: 5px;
          min-height: 34px;
          padding: 4px 2px;
          border-bottom: 1px solid #d1d5db;
          background: #ffffff;
        }

        .money-tracker-compact .mt-entry-text {
          min-width: 0;
          overflow: hidden;
          color: #374151;
          font-size: 10.8px;
          font-weight: 500;
          line-height: 1.2;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .money-tracker-compact .mt-entry-amount {
          color: #8d0000;
          font-size: 13.2px;
          font-weight: 800;
          white-space: nowrap;
        }

        .money-tracker-compact .mt-entry-income {
          color: #087a2b;
        }

        .money-tracker-compact .mt-entry-action,
        .money-tracker-compact .mt-entry-delete {
          min-height: 25px;
          height: 25px;
          border: 0;
          border-radius: 5px;
          padding: 0 6px;
          font: inherit;
          font-size: 9.6px;
          font-weight: 700;
          cursor: pointer;
        }

        .money-tracker-compact .mt-entry-action {
          background: #f1f3f6;
          color: #374151;
        }

        .money-tracker-compact .mt-entry-delete {
          background: #fff0f0;
          color: #c80000;
        }

        @media (max-width: 390px) {
          .money-tracker-compact .mt-section-bar {
            grid-template-columns: 1fr !important;
          }

          .money-tracker-compact .mt-filter-buttons {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .money-tracker-compact .mt-entry-row {
            gap: 3px;
          }

          .money-tracker-compact .mt-entry-text {
            font-size: 10.2px;
          }

          .money-tracker-compact .mt-entry-action,
          .money-tracker-compact .mt-entry-delete {
            padding: 0 4px;
            font-size: 9px;
          }
        }
      `}</style>
    </div>
  );
}
