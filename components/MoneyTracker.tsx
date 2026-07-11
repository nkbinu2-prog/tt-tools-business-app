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

function makeForm(type: TrackerType) {
  return {
    date: todayIso(),
    details: "",
    amount: "",
    mode: (type === "income" ? "GPay" : "") as IncomeMode,
    notes: "",
  };
}

export default function MoneyTracker({ type }: { type: TrackerType }) {
  const isExpense = type === "expense";
  const storageKey = isExpense ? STORAGE_KEYS.expenses : STORAGE_KEYS.income;
  const { items, setItems } = useStoredList<MoneyEntry>(storageKey);
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

        return `${item.details} ${item.mode} ${item.notes} ${item.date} ${item.amount}`
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

  function startEdit(item: MoneyEntry) {
    setEditingId(item.id);
    setForm({
      date: item.date,
      details: item.details,
      amount: String(item.amount),
      mode: isExpense ? "" : item.mode || "GPay",
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

  return (
    <div className={`${ui.screen} money-tracker-150`}>
      <div className={ui.summaryRow}>
        <div className={ui.summaryCard}>
          <div className={`${ui.summaryLabel} mt-summary-label`}>Today</div>
          <div className={`${ui.summaryValue} mt-summary-value`}>
            {formatCurrency(todayTotal)}
          </div>
        </div>

        <div className={ui.summaryCard}>
          <div className={`${ui.summaryLabel} mt-summary-label`}>
            This Month
          </div>
          <div className={`${ui.summaryValue} mt-summary-value`}>
            {formatCurrency(monthTotal)}
          </div>
        </div>
      </div>

      <form className={`${ui.panel} ${ui.composer}`} onSubmit={save}>
        <div className={ui.formStack}>
          {isExpense ? (
            <div>
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
            <div>
              <label className={`${ui.label} mt-label`}>Mode</label>

              <div className={ui.modeButtons}>
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
                          : "👤 Staff Collection"}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          <div>
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

          <div>
            <label className={`${ui.label} mt-label`}>Notes</label>
            <textarea
              className={`${ui.textarea} mt-textarea`}
              style={{ minHeight: 84 }}
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
              placeholder="Optional notes"
            />
          </div>

          <div>
            <label className={`${ui.label} mt-label`}>Date</label>

            <div className={ui.dateToggleRow}>
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

        <div className={ui.composerTools}>
          <div />

          <div className={ui.actionGroup}>
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

      <div className={ui.sectionBar}>
        <div className={ui.filterButtons}>
          {(["Today", "Month", "All"] as const).map((name) => (
            <button
              key={name}
              type="button"
              className={`${ui.filterButton} mt-control-button ${
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
        <div className={ui.moneyList}>
          {visibleItems.map((item) => (
            <article className={ui.moneyCard} key={item.id}>
              <div>
                <p className={`${ui.moneyTitle} mt-money-title`}>
                  {isExpense ? item.details : item.mode || "Income"}
                </p>

                <div className={`${ui.meta} mt-meta`}>
                  {formatDisplayDate(item.date)}
                </div>

                {item.notes ? (
                  <div className={`${ui.moneyNotes} mt-meta`}>
                    {item.notes}
                  </div>
                ) : null}

                <div className={ui.cardActions} style={{ marginTop: 9 }}>
                  {!isExpense && item.mode ? (
                    <span className={`${ui.modeBadge} mt-badge`}>
                      {item.mode}
                    </span>
                  ) : null}

                  <button
                    type="button"
                    className={`${ui.smallButton} mt-small-button`}
                    onClick={() => startEdit(item)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className={`${ui.dangerButton} mt-small-button`}
                    onClick={() => remove(item.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className={ui.moneyRight}>
                <div
                  className={`${ui.moneyAmount} mt-money-amount ${
                    !isExpense ? ui.incomeAmount : ""
                  }`}
                >
                  {formatCurrency(item.amount)}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <style jsx global>{`
        .money-tracker-150 .mt-summary-label {
          font-size: 16.5px !important;
        }

        .money-tracker-150 .mt-summary-value {
          font-size: 40.5px !important;
        }

        .money-tracker-150 .mt-label {
          font-size: 18px !important;
        }

        .money-tracker-150 .mt-field,
        .money-tracker-150 .mt-textarea,
        .money-tracker-150 .mt-date-input {
          font-size: 22.5px !important;
        }

        .money-tracker-150 .mt-mode-button {
          font-size: 19.5px !important;
        }

        .money-tracker-150 .mt-amount-input {
          font-size: 45px !important;
        }

        .money-tracker-150 .mt-control-button {
          font-size: 18px !important;
        }

        .money-tracker-150 .mt-search-input {
          font-size: 21px !important;
        }

        .money-tracker-150 .mt-money-title {
          font-size: 24px !important;
        }

        .money-tracker-150 .mt-meta {
          font-size: 18px !important;
        }

        .money-tracker-150 .mt-badge {
          font-size: 16.5px !important;
        }

        .money-tracker-150 .mt-small-button {
          font-size: 16px !important;
        }

        .money-tracker-150 .mt-money-amount {
          font-size: 33px !important;
        }

        .money-tracker-150 .mt-empty {
          font-size: 21px !important;
        }

        @media (max-width: 760px) {
          .money-tracker-150 .mt-field,
          .money-tracker-150 .mt-date-input {
            font-size: 21px !important;
          }

          .money-tracker-150 .mt-summary-value {
            font-size: 38px !important;
          }

          .money-tracker-150 .mt-control-button {
            min-height: 48px;
          }
        }
      `}</style>
    </div>
  );
}
