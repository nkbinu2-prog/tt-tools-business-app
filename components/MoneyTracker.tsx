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

  function resetForm() {
    setEditingId(null);
    setForm(makeForm(type));
  }

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

    resetForm();
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

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));

    if (editingId === id) {
      resetForm();
    }
  }

  return (
    <div className={`${ui.screen} ${ui.compactMoneyScreen}`}>
      <div className={ui.compactMoneyTotals}>
        <span>Today <b>{formatCurrency(todayTotal)}</b></span>
        <span>Month <b>{formatCurrency(monthTotal)}</b></span>
      </div>

      <form className={ui.compactMoneyForm} onSubmit={save}>
        <div className={ui.compactMoneyRowOne}>
          {isExpense ? (
            <input
              className={ui.compactMoneyInput}
              value={form.details}
              onChange={(event) =>
                setForm({ ...form, details: event.target.value })
              }
              placeholder="Expense details"
              required
            />
          ) : (
            <div className={ui.compactIncomeModes}>
              {(["GPay", "Cash", "Staff Collection"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={
                    form.mode === mode ? ui.compactIncomeModeActive : ""
                  }
                  onClick={() => setForm({ ...form, mode })}
                >
                  {mode === "Staff Collection" ? "Staff" : mode}
                </button>
              ))}
            </div>
          )}

          <input
            className={`${ui.compactMoneyInput} ${ui.compactAmountInput}`}
            type="number"
            min="1"
            step="1"
            inputMode="decimal"
            value={form.amount}
            onChange={(event) =>
              setForm({ ...form, amount: event.target.value })
            }
            placeholder="₹ Amount"
            required
          />
        </div>

        <div className={ui.compactMoneyRowTwo}>
          <input
            className={ui.compactMoneyInput}
            value={form.notes}
            onChange={(event) =>
              setForm({ ...form, notes: event.target.value })
            }
            placeholder="Notes"
          />

          <input
            className={`${ui.compactMoneyInput} ${ui.compactDateInput}`}
            type="date"
            value={form.date}
            onChange={(event) =>
              setForm({ ...form, date: event.target.value })
            }
          />

          {editingId ? (
            <button
              type="button"
              className={ui.compactCancelButton}
              onClick={resetForm}
              aria-label="Cancel editing"
            >
              ×
            </button>
          ) : null}

          <button type="submit" className={ui.compactSaveButton}>
            {editingId ? "Update" : "Save"}
          </button>
        </div>
      </form>

      <div className={ui.compactMoneyTools}>
        <div className={ui.compactMoneyFilters}>
          {(["Today", "Month", "All"] as const).map((name) => (
            <button
              key={name}
              type="button"
              className={filter === name ? ui.compactFilterActive : ""}
              onClick={() => setFilter(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <input
          className={ui.compactMoneySearch}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
        />
      </div>

      {visibleItems.length === 0 ? (
        <div className={ui.compactMoneyEmpty}>
          No {type} entries.
        </div>
      ) : (
        <div className={ui.compactMoneyList}>
          {visibleItems.map((item) => (
            <article className={ui.compactMoneyLine} key={item.id}>
              <button
                type="button"
                className={ui.compactMoneyMain}
                onClick={() => startEdit(item)}
              >
                <strong>
                  {isExpense ? item.details : item.mode || "Income"}
                </strong>
                <span>
                  {formatDisplayDate(item.date)}
                  {item.notes ? ` · ${item.notes}` : ""}
                </span>
              </button>

              <div
                className={`${ui.compactMoneyAmount} ${
                  !isExpense ? ui.compactIncomeAmount : ""
                }`}
              >
                {formatCurrency(item.amount)}
              </div>

              <button
                type="button"
                className={ui.compactDeleteButton}
                onClick={() => remove(item.id)}
                aria-label="Delete entry"
              >
                ×
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
