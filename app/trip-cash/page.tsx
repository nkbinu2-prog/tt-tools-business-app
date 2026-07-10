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
    shop: SHOPS[0] as string,
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
    if (!form.customer.trim() || !form.location.trim() || !Number.isFinite(amount) || amount <= 0) return;
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
      <div className={ui.screen}>
        <div className={ui.tripSummaryGrid}>
          <div className={ui.summaryCard}>
            <div className={ui.summaryLabel}>Pending Cash</div>
            <div className={ui.summaryValue}>{formatCurrency(pendingAmount)}</div>
          </div>
          <div className={ui.summaryCard}>
            <div className={ui.summaryLabel}>Pending Customers</div>
            <div className={ui.summaryValue}>{pendingItems.length}</div>
          </div>
          <div className={ui.summaryCard}>
            <div className={ui.summaryLabel}>Total Trips</div>
            <div className={ui.summaryValue}>{pendingTrips}</div>
          </div>
        </div>

        <form className={`${ui.panel} ${ui.composer}`} onSubmit={save}>
          <div className={ui.formStack}>
            <div>
              <label className={ui.label}>Customer Name</label>
              <input className={ui.field} value={form.customer} onChange={(event) => setForm({ ...form, customer: event.target.value })} placeholder="Customer name" required />
            </div>

            <div className={ui.tripTwoColumns}>
              <div>
                <label className={ui.label}>Shop</label>
                <select className={ui.select} value={form.shop} onChange={(event) => setForm({ ...form, shop: event.target.value })}>
                  {SHOPS.map((shop) => <option key={shop}>{shop}</option>)}
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className={ui.label}>Location</label>
                <input className={ui.field} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Trip location" required />
              </div>
            </div>

            {form.shop === "Other" ? (
              <div>
                <label className={ui.label}>Other Shop Name</label>
                <input className={ui.field} value={form.customShop} onChange={(event) => setForm({ ...form, customShop: event.target.value })} placeholder="Enter shop name" required />
              </div>
            ) : null}

            <div className={ui.tripAmountRow}>
              <div>
                <label className={ui.label}>Amount</label>
                <input className={ui.amountInput} type="number" min="1" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="₹ 0" required />
              </div>
              <div>
                <label className={ui.label}>Trips</label>
                <div className={ui.bigQtyControl}>
                  <button type="button" className={ui.qtyButton} onClick={() => setForm({ ...form, trips: Math.max(1, form.trips - 1) })}>−</button>
                  <div className={ui.bigQtyValue}>{form.trips}</div>
                  <button type="button" className={ui.qtyButton} onClick={() => setForm({ ...form, trips: form.trips + 1 })}>+</button>
                </div>
              </div>
            </div>

            <div>
              <label className={ui.label}>Date</label>
              <div className={ui.dateToggleRow}>
                <button type="button" className={`${ui.filterButton} ${form.date === todayIso() ? ui.filterButtonActive : ""}`} onClick={() => setForm({ ...form, date: todayIso() })}>Today</button>
                <input className={ui.dateInput} type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
              </div>
            </div>

            <div>
              <label className={ui.label}>Notes</label>
              <textarea className={ui.textarea} style={{ minHeight: 70 }} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional note" />
            </div>
          </div>

          <div className={ui.composerTools}>
            <div />
            <div className={ui.actionGroup}>
              {editingId ? <button type="button" className={ui.secondaryButton} onClick={cancelEdit}>Cancel</button> : null}
              <button type="submit" className={ui.primaryButton}>{editingId ? "Update" : "Save Trip Cash"}</button>
            </div>
          </div>
        </form>

        <div className={ui.sectionBar}>
          <div className={ui.filterButtons}>
            {(["Pending", "Received", "All"] as const).map((name) => (
              <button key={name} type="button" className={`${ui.filterButton} ${filter === name ? ui.filterButtonActive : ""}`} onClick={() => setFilter(name)}>{name}</button>
            ))}
          </div>
          <input className={ui.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or location" />
        </div>

        {visibleItems.length === 0 ? (
          <div className={ui.empty}>No Trip Cash records found.</div>
        ) : (
          <div className={ui.tripCashList}>
            {visibleItems.map((item) => {
              const shopName = item.shop === "Other" ? item.customShop : item.shop;
              return (
                <article className={`${ui.tripCashCard} ${item.status === "Received" ? ui.receivedCard : ""}`} key={item.id}>
                  <div className={ui.tripCashTop}>
                    <div>
                      <h3>{item.customer}</h3>
                      <p>{shopName} · {item.location}</p>
                    </div>
                    <div className={ui.tripCashAmount}>{formatCurrency(item.amount)}</div>
                  </div>
                  <div className={ui.tripCashMeta}>
                    <span>🚗 {item.trips} {item.trips === 1 ? "trip" : "trips"}</span>
                    <span>📅 {formatDisplayDate(item.date)}</span>
                  </div>
                  {item.notes ? <div className={ui.tripCashNote}>{item.notes}</div> : null}
                  {item.receivedAt ? <div className={ui.receivedText}>Received {formatDateTime(item.receivedAt)}</div> : null}
                  <div className={ui.tripCashActions}>
                    {item.status === "Pending" ? (
                      <button type="button" className={ui.receivedButton} onClick={() => markReceived(item.id)}>✓ Money Received</button>
                    ) : (
                      <button type="button" className={ui.smallButton} onClick={() => restorePending(item.id)}>Move to Pending</button>
                    )}
                    <button type="button" className={ui.smallButton} onClick={() => edit(item)}>Edit</button>
                    <button type="button" className={ui.dangerButton} onClick={() => remove(item.id)}>Delete</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
