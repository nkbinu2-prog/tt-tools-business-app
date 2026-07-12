"use client";

import { FormEvent, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import ui from "@/components/MobileBusiness.module.css";
import {
  SHOPS,
  STORAGE_KEYS,
  formatCurrency,
  formatDisplayDate,
  formatDateTime,
  makeId,
  nowLocalDateTime,
  todayIso,
  type TripCashEntry,
} from "@/lib/business-data";
import { useStoredList } from "@/lib/useStoredList";

type Filter = "Pending" | "Received" | "All";

function blankForm() {
  return {
    customer: "",
    shop: "",
    customShop: "",
    location: "",
    amount: "",
    trips: 1,
    date: todayIso(),
    notes: "",
  };
}

export default function TripCashPage() {
  const { items, setItems } = useStoredList<TripCashEntry>(STORAGE_KEYS.tripCash);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("Pending");
  const [search, setSearch] = useState("");

  const pendingItems = useMemo(() => items.filter((item) => item.status === "Pending"), [items]);
  const pendingAmount = useMemo(() => pendingItems.reduce((sum, item) => sum + item.amount, 0), [pendingItems]);
  const pendingTrips = useMemo(() => pendingItems.reduce((sum, item) => sum + item.trips, 0), [pendingItems]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...items]
      .filter((item) => filter === "All" || item.status === filter)
      .filter((item) => {
        if (!query) return true;
        return `${item.customer} ${item.shop} ${item.customShop} ${item.location} ${item.notes} ${item.amount} ${item.date}`.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "Pending" ? -1 : 1;
        return b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt;
      });
  }, [filter, items, search]);

  function save(event: FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (
      !form.customer.trim() ||
      !form.shop ||
      !form.location.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) return;
    if (form.shop === "Other" && !form.customShop.trim()) return;

    if (editingId) {
      setItems((current) => current.map((item) => item.id === editingId ? {
        ...item,
        customer: form.customer.trim(),
        shop: form.shop,
        customShop: form.shop === "Other" ? form.customShop.trim() : "",
        location: form.location.trim(),
        amount,
        trips: Math.max(1, form.trips),
        date: form.date,
        notes: form.notes.trim(),
        updatedAt: Date.now(),
      } : item));
    } else {
      const now = Date.now();
      setItems((current) => [{
        id: makeId("trip-cash"),
        customer: form.customer.trim(),
        shop: form.shop,
        customShop: form.shop === "Other" ? form.customShop.trim() : "",
        location: form.location.trim(),
        amount,
        trips: Math.max(1, form.trips),
        date: form.date,
        notes: form.notes.trim(),
        status: "Pending",
        createdAt: now,
        updatedAt: now,
      }, ...current]);
    }

    setEditingId(null);
    setForm(blankForm());
  }

  function edit(item: TripCashEntry) {
    setEditingId(item.id);
    setForm({
      customer: item.customer,
      shop: item.shop,
      customShop: item.customShop,
      location: item.location,
      amount: String(item.amount),
      trips: item.trips,
      date: item.date,
      notes: item.notes,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(blankForm());
  }

  function markReceived(id: string) {
    setItems((current) => current.map((item) => item.id === id ? {
      ...item,
      status: "Received",
      receivedAt: nowLocalDateTime(),
      updatedAt: Date.now(),
    } : item));
  }

  function restorePending(id: string) {
    setItems((current) => current.map((item) => item.id === id ? {
      ...item,
      status: "Pending",
      receivedAt: undefined,
      updatedAt: Date.now(),
    } : item));
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    if (editingId === id) cancelEdit();
  }

  return (
    <AppShell title="Trip Cash" subtitle="Record shop trips and clear them when money is received">
      <div className={`${ui.screen} trip-cash-compact`}>
        <div className={`${ui.tripSummaryGrid} tc-summary-grid`}>
          <div className={`${ui.summaryCard} tc-summary-card`}>
            <div className={`${ui.summaryLabel} tc-summary-label`}>Pending Cash</div>
            <div className={`${ui.summaryValue} tc-summary-value`}>{formatCurrency(pendingAmount)}</div>
          </div>
          <div className={`${ui.summaryCard} tc-summary-card`}>
            <div className={`${ui.summaryLabel} tc-summary-label`}>Pending Customers</div>
            <div className={`${ui.summaryValue} tc-summary-value`}>{pendingItems.length}</div>
          </div>
          <div className={`${ui.summaryCard} tc-summary-card`}>
            <div className={`${ui.summaryLabel} tc-summary-label`}>Total Trips</div>
            <div className={`${ui.summaryValue} tc-summary-value`}>{pendingTrips}</div>
          </div>
        </div>

        <form className={`${ui.panel} ${ui.composer} tc-form`} onSubmit={save}>
          <div className={`${ui.formStack} tc-form-stack`}>
            <div>
              <input
                className={`${ui.field} tc-field`}
                value={form.customer}
                onChange={(event) =>
                  setForm({ ...form, customer: event.target.value })
                }
                placeholder="Customer Name"
                aria-label="Customer Name"
                required
              />
            </div>

            <div className={ui.tripTwoColumns}>
              <div>
                <select
                  className={`${ui.select} tc-field`}
                  value={form.shop}
                  onChange={(event) =>
                    setForm({ ...form, shop: event.target.value })
                  }
                  aria-label="Shop"
                  required
                >
                  <option value="" disabled>
                    Shop
                  </option>
                  {SHOPS.map((shop) => (
                    <option key={shop}>{shop}</option>
                  ))}
                  <option>Other</option>
                </select>
              </div>
              <div>
                <input
                  className={`${ui.field} tc-field`}
                  value={form.location}
                  onChange={(event) =>
                    setForm({ ...form, location: event.target.value })
                  }
                  placeholder="Location"
                  aria-label="Location"
                  required
                />
              </div>
            </div>

            {form.shop === "Other" ? (
              <div>
                <input
                  className={`${ui.field} tc-field`}
                  value={form.customShop}
                  onChange={(event) =>
                    setForm({ ...form, customShop: event.target.value })
                  }
                  placeholder="Other Shop Name"
                  aria-label="Other Shop Name"
                  required
                />
              </div>
            ) : null}

            <div className={ui.tripAmountRow}>
              <div>
                <input
                  className={`${ui.amountInput} tc-amount-input`}
                  type="number"
                  min="1"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) =>
                    setForm({ ...form, amount: event.target.value })
                  }
                  placeholder="Amount"
                  aria-label="Amount"
                  required
                />
              </div>
              <div>
                <label className={`${ui.label} tc-label`}>Trips</label>
                <div className={ui.bigQtyControl}>
                  <button type="button" className={`${ui.qtyButton} tc-qty-button`} onClick={() => setForm({ ...form, trips: Math.max(1, form.trips - 1) })}>−</button>
                  <div className={`${ui.bigQtyValue} tc-qty-value`}>{form.trips}</div>
                  <button type="button" className={`${ui.qtyButton} tc-qty-button`} onClick={() => setForm({ ...form, trips: form.trips + 1 })}>+</button>
                </div>
              </div>
            </div>

            <div>
              <div className={ui.dateToggleRow}>
                <button type="button" className={`${ui.filterButton} tc-control-button ${form.date === todayIso() ? ui.filterButtonActive : ""}`} onClick={() => setForm({ ...form, date: todayIso() })}>Today</button>
                <input className={`${ui.dateInput} tc-date-input`} type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
              </div>
            </div>

            <div>
              <textarea
                className={`${ui.textarea} tc-textarea`}
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
                placeholder="Notes"
                aria-label="Notes"
              />
            </div>
          </div>

          <div className={`${ui.composerTools} tc-composer-tools`}>
            <div />
            <div className={`${ui.actionGroup} tc-action-group`}>
              {editingId ? <button type="button" className={`${ui.secondaryButton} tc-control-button`} onClick={cancelEdit}>Cancel</button> : null}
              <button type="submit" className={`${ui.primaryButton} tc-control-button`}>{editingId ? "Update" : "Save Trip Cash"}</button>
            </div>
          </div>
        </form>

        <div className={`${ui.sectionBar} tc-section-bar`}>
          <div className={`${ui.filterButtons} tc-filter-buttons`}>
            {(["Pending", "Received", "All"] as const).map((name) => (
              <button key={name} type="button" className={`${ui.filterButton} tc-filter-button ${filter === name ? ui.filterButtonActive : ""}`} onClick={() => setFilter(name)}>{name}</button>
            ))}
          </div>
          <input className={`${ui.searchInput} tc-search-input`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or location" />
        </div>

        {visibleItems.length === 0 ? (
          <div className={`${ui.empty} tc-empty`}>No Trip Cash records found.</div>
        ) : (
          <div className="tc-record-list">
            {visibleItems.map((item) => {
              const shopName = item.shop === "Other" ? item.customShop : item.shop;

              return (
                <article
                  className={`tc-record-row ${
                    item.status === "Received" ? "tc-record-received" : ""
                  }`}
                  key={item.id}
                >
                  <button
                    type="button"
                    className="tc-record-open"
                    onClick={() => edit(item)}
                    title="Tap to edit"
                    aria-label={`Edit ${item.customer}`}
                  >
                    <span className="tc-record-line tc-record-line-one">
                      <span className="tc-record-name" title={item.customer}>
                        {item.customer}
                      </span>

                      <span
                        className="tc-record-place"
                        title={`${shopName} · ${item.location}`}
                      >
                        {shopName} · {item.location}
                      </span>

                      <span
                        className={`tc-record-status ${
                          item.status === "Received" ? "received" : "pending"
                        }`}
                      >
                        {item.status}
                      </span>

                      <span className="tc-record-amount">
                        {formatCurrency(item.amount)}
                      </span>
                    </span>

                    <span className="tc-record-meta">
                      {item.trips} {item.trips === 1 ? "trip" : "trips"} ·{" "}
                      {formatDisplayDate(item.date)}
                      {item.notes ? ` · ${item.notes}` : ""}
                      {item.receivedAt
                        ? ` · Received ${formatDateTime(item.receivedAt)}`
                        : ""}
                    </span>
                  </button>

                  <div className="tc-record-actions">
                    {item.status === "Pending" ? (
                      <button
                        type="button"
                        className="tc-record-button tc-received-button"
                        onClick={() => markReceived(item.id)}
                      >
                        ✓ Received
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="tc-record-button"
                        onClick={() => restorePending(item.id)}
                      >
                        To Pending
                      </button>
                    )}

                    <button
                      type="button"
                      className="tc-record-button tc-delete-button"
                      onClick={() => remove(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <style jsx global>{`
        .trip-cash-compact {
          font-weight: 600;
          font-size: 12px;
        }

        .trip-cash-compact input,
        .trip-cash-compact textarea,
        .trip-cash-compact select,
        .trip-cash-compact button {
          font-weight: 650 !important;
        }

        .trip-cash-compact .tc-summary-label,
        .trip-cash-compact .tc-summary-value,
        .trip-cash-compact .tc-label,
        .trip-cash-compact .tc-record-name,
        .trip-cash-compact .tc-record-place,
        .trip-cash-compact .tc-record-meta,
        .trip-cash-compact .tc-record-status,
        .trip-cash-compact .tc-record-amount {
          font-weight: 700 !important;
        }

        .trip-cash-compact .tc-summary-grid {
          gap: 5px !important;
          margin-bottom: 7px !important;
        }

        .trip-cash-compact .tc-summary-card {
          min-height: 48px !important;
          padding: 6px 7px !important;
          border-radius: 8px !important;
          box-shadow: none !important;
        }

        .trip-cash-compact .tc-summary-label {
          font-size: 9px !important;
          line-height: 1 !important;
        }

        .trip-cash-compact .tc-summary-value {
          margin-top: 3px !important;
          font-size: 20.4px !important;
          line-height: 1 !important;
        }

        .trip-cash-compact .tc-form {
          padding: 8px !important;
          border-radius: 9px !important;
          box-shadow: none !important;
        }

        .trip-cash-compact .tc-form-stack {
          gap: 6px !important;
        }

        .trip-cash-compact .tc-label {
          margin-bottom: 3px !important;
          font-size: 10.2px !important;
          line-height: 1.1 !important;
        }

        .trip-cash-compact .tc-field,
        .trip-cash-compact .tc-date-input {
          min-height: 31px !important;
          height: 31px !important;
          border-radius: 6px !important;
          padding: 0 7px !important;
          font-size: 12px !important;
        }

        .trip-cash-compact .tc-amount-input {
          min-height: 37px !important;
          height: 37px !important;
          border-radius: 7px !important;
          padding: 0 8px !important;
          font-size: 22.8px !important;
        }

        .trip-cash-compact .tc-textarea {
          min-height: 40px !important;
          height: 40px !important;
          resize: none !important;
          border-radius: 6px !important;
          padding: 6px 7px !important;
          font-size: 12px !important;
          line-height: 1.15 !important;
        }

        .trip-cash-compact .tc-qty-button {
          min-width: 31px !important;
          width: 31px !important;
          min-height: 31px !important;
          height: 31px !important;
          font-size: 18px !important;
        }

        .trip-cash-compact .tc-qty-value {
          min-height: 31px !important;
          height: 31px !important;
          font-size: 16.8px !important;
          line-height: 31px !important;
        }

        .trip-cash-compact .tc-control-button {
          min-height: 31px !important;
          height: 31px !important;
          border-radius: 6px !important;
          padding: 0 8px !important;
          font-size: 10.8px !important;
        }

        .trip-cash-compact .tc-composer-tools {
          margin-top: 7px !important;
        }

        .trip-cash-compact .tc-action-group {
          gap: 5px !important;
        }

        .trip-cash-compact .tc-section-bar {
          display: grid !important;
          grid-template-columns: auto minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 5px !important;
          margin: 8px 0 4px !important;
        }

        .trip-cash-compact .tc-filter-buttons {
          display: flex !important;
          flex-wrap: nowrap !important;
          gap: 3px !important;
        }

        .trip-cash-compact .tc-filter-button {
          min-height: 29px !important;
          height: 29px !important;
          border-radius: 6px !important;
          padding: 0 6px !important;
          font-size: 9.6px !important;
        }

        .trip-cash-compact .tc-search-input {
          width: 100% !important;
          min-height: 29px !important;
          height: 29px !important;
          border-radius: 6px !important;
          padding: 0 7px !important;
          font-size: 10.8px !important;
        }

        .trip-cash-compact .tc-empty {
          padding: 14px 6px !important;
          font-size: 10.8px !important;
        }

        .trip-cash-compact .tc-record-list {
          border-top: 1px solid #d1d5db;
          background: #ffffff;
        }

        .trip-cash-compact .tc-record-row {
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 5px;
          padding: 5px 3px;
          border-bottom: 1px solid #d1d5db;
          background: #ffffff;
        }

        .trip-cash-compact .tc-record-received {
          background: #fbfffc;
        }

        .trip-cash-compact .tc-record-open {
          min-width: 0;
          display: grid;
          gap: 3px;
          border: 0;
          background: transparent;
          padding: 0;
          text-align: left;
          cursor: pointer;
        }

        .trip-cash-compact .tc-record-line {
          min-width: 0;
          display: grid;
          align-items: center;
          gap: 5px;
        }

        .trip-cash-compact .tc-record-line-one {
          grid-template-columns:
            minmax(70px, 1fr)
            minmax(85px, 1.35fr)
            auto
            auto;
          min-height: 19px;
        }

        .trip-cash-compact .tc-record-name,
        .trip-cash-compact .tc-record-place,
        .trip-cash-compact .tc-record-meta {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .trip-cash-compact .tc-record-name {
          color: #111827;
          font-size: 13.11px;
          font-weight: 800;
        }

        .trip-cash-compact .tc-record-place,
        .trip-cash-compact .tc-record-meta {
          color: #5b6472;
          font-size: 10.76px;
          font-weight: 600;
        }

        .trip-cash-compact .tc-record-status {
          font-size: 9.66px;
          font-weight: 800;
          white-space: nowrap;
        }

        .trip-cash-compact .tc-record-status.pending {
          color: #a33a00;
        }

        .trip-cash-compact .tc-record-status.received {
          color: #087a2b;
        }

        .trip-cash-compact .tc-record-amount {
          color: #111827;
          font-size: 14.49px;
          font-weight: 900;
          white-space: nowrap;
        }

        .trip-cash-compact .tc-record-actions {
          display: flex;
          flex-wrap: nowrap;
          gap: 3px;
        }

        .trip-cash-compact .tc-record-button {
          min-height: 23px;
          height: 23px;
          border: 0;
          border-radius: 5px;
          background: #f1f3f6;
          color: #374151;
          padding: 0 5px;
          font-size: 9.66px;
          font-weight: 800;
          white-space: nowrap;
          cursor: pointer;
        }

        .trip-cash-compact .tc-received-button {
          background: #e8f8ed;
          color: #087a2b;
        }

        .trip-cash-compact .tc-delete-button {
          background: #fff0f0;
          color: #c80000;
        }

        @media (max-width: 390px) {
          .trip-cash-compact .tc-section-bar {
            grid-template-columns: 1fr !important;
          }

          .trip-cash-compact .tc-filter-buttons {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .trip-cash-compact .tc-record-line-one {
            grid-template-columns:
              minmax(60px, 1fr)
              minmax(70px, 1.2fr)
              auto;
            gap: 3px;
          }

          .trip-cash-compact .tc-record-status {
            display: none;
          }

          .trip-cash-compact .tc-record-line-two {
            gap: 3px;
          }

          .trip-cash-compact .tc-record-name {
            font-size: 12.42px;
          }

          .trip-cash-compact .tc-record-place,
          .trip-cash-compact .tc-record-meta {
            font-size: 10.07px;
          }

          .trip-cash-compact .tc-record-button {
            padding: 0 4px;
            font-size: 9.11px;
          }
        }
      `}</style>

    </AppShell>
  );
}
