"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import ui from "@/components/MobileBusiness.module.css";
import {
  STORAGE_KEYS,
  formatDisplayDate,
  makeId,
  todayIso,
  type NoteColor,
  type ReminderItem,
} from "@/lib/business-data";
import { useStoredList } from "@/lib/useStoredList";

const colors: NoteColor[] = ["yellow", "blue", "green", "pink", "white"];

function blankForm() {
  return {
    title: "",
    details: "",
    hasReminder: false,
    date: todayIso(),
    time: "09:00",
    color: "yellow" as NoteColor,
  };
}

function noteColorClass(color: NoteColor) {
  return color === "blue"
    ? ui.colorBlue
    : color === "green"
      ? ui.colorGreen
      : color === "pink"
        ? ui.colorPink
        : color === "white"
          ? ui.colorWhite
          : ui.colorYellow;
}

function reminderTime(item: ReminderItem) {
  if (!item.hasReminder || !item.date) return null;
  return new Date(`${item.date}T${item.time || "00:00"}:00`).getTime();
}

export default function RemindersPage() {
  const { items, setItems } = useStoredList<ReminderItem>(STORAGE_KEYS.reminders);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "Reminders" | "Completed">("All");
  const [alertsAvailable, setAlertsAvailable] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const updateClientState = () => {
      setCurrentTime(Date.now());
      setAlertsAvailable(
        typeof Notification !== "undefined" &&
          Notification.permission !== "granted"
      );
    };

    updateClientState();
    const timer = window.setInterval(updateClientState, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return;

    const checkDue = () => {
      const now = Date.now();
      const due = items.filter((item) => {
        const time = reminderTime(item);
        return item.hasReminder && !item.completed && !item.notifiedAt && time !== null && time <= now;
      });

      if (due.length === 0) return;

      if (Notification.permission === "granted") {
        due.forEach((item) => {
          new Notification(item.title || "T&T Tools Reminder", {
            body: item.details || "Reminder time reached",
            icon: "/tt-logo.png",
          });
        });
      }

      const dueIds = new Set(due.map((item) => item.id));
      setItems((current) => current.map((item) => dueIds.has(item.id) ? { ...item, notifiedAt: now } : item));
    };

    checkDue();
    const timer = window.setInterval(checkDue, 30_000);
    return () => window.clearInterval(timer);
  }, [items, setItems]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...items]
      .filter((item) => {
        if (filter === "Reminders") return item.hasReminder && !item.completed;
        if (filter === "Completed") return item.completed;
        return true;
      })
      .filter((item) => !query || `${item.title} ${item.details}`.toLowerCase().includes(query))
      .sort((a, b) => {
        if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
        const aTime = reminderTime(a) ?? a.updatedAt;
        const bTime = reminderTime(b) ?? b.updatedAt;
        return bTime - aTime;
      });
  }, [filter, items, search]);

  function save(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim() && !form.details.trim()) return;

    if (editingId) {
      setItems((current) => current.map((item) => item.id === editingId ? {
        ...item,
        title: form.title.trim(),
        details: form.details.trim(),
        hasReminder: form.hasReminder,
        date: form.hasReminder ? form.date : "",
        time: form.hasReminder ? form.time : "",
        color: form.color,
        notifiedAt: undefined,
        updatedAt: Date.now(),
      } : item));
    } else {
      const now = Date.now();
      setItems((current) => [{
        id: makeId("note"),
        title: form.title.trim(),
        details: form.details.trim(),
        hasReminder: form.hasReminder,
        date: form.hasReminder ? form.date : "",
        time: form.hasReminder ? form.time : "",
        completed: false,
        color: form.color,
        createdAt: now,
        updatedAt: now,
      }, ...current]);
    }

    setEditingId(null);
    setForm(blankForm());
  }

  function startEdit(item: ReminderItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      details: item.details,
      hasReminder: item.hasReminder,
      date: item.date || todayIso(),
      time: item.time || "09:00",
      color: item.color || "yellow",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(blankForm());
  }

  function toggleCompleted(id: string) {
    setItems((current) => current.map((item) => item.id === id ? {
      ...item,
      completed: !item.completed,
      notifiedAt: item.completed ? undefined : item.notifiedAt,
      updatedAt: Date.now(),
    } : item));
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    if (editingId === id) cancelEdit();
  }

  async function enableAlerts() {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setAlertsAvailable(permission !== "granted");
  }

  return (
    <AppShell title="Notes & Reminders" subtitle="Quick notes with optional reminder time">
      <div className={ui.screen}>
        <form className={`${ui.panel} ${ui.composer}`} onSubmit={save}>
          <div className={ui.formStack}>
            <input
              className={`${ui.field} ${ui.titleInput}`}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Title"
            />
            <textarea
              className={ui.textarea}
              value={form.details}
              onChange={(event) => setForm({ ...form, details: event.target.value })}
              placeholder="Write a note..."
            />
          </div>

          {form.hasReminder ? (
            <div className={ui.reminderRow}>
              <input className={ui.dateInput} type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
              <input className={ui.dateInput} type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
            </div>
          ) : null}

          <div className={ui.composerTools}>
            <div className={ui.toolGroup}>
              <button
                type="button"
                className={`${ui.iconButton} ${form.hasReminder ? ui.iconButtonActive : ""}`}
                onClick={() => setForm({ ...form, hasReminder: !form.hasReminder })}
              >
                🔔 {form.hasReminder ? "Reminder On" : "Add Reminder"}
              </button>
              <div className={ui.colorRow} aria-label="Note colour">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`${color} note`}
                    className={`${ui.colorButton} ${noteColorClass(color)} ${form.color === color ? ui.colorSelected : ""}`}
                    onClick={() => setForm({ ...form, color })}
                  />
                ))}
              </div>
            </div>

            <div className={ui.actionGroup}>
              {editingId ? <button type="button" className={ui.secondaryButton} onClick={cancelEdit}>Cancel</button> : null}
              <button type="submit" className={ui.primaryButton}>{editingId ? "Update" : "Save"}</button>
            </div>
          </div>
        </form>

        <div className={ui.sectionBar}>
          <div className={ui.filterButtons}>
            {(["All", "Reminders", "Completed"] as const).map((name) => (
              <button key={name} type="button" className={`${ui.filterButton} ${filter === name ? ui.filterButtonActive : ""}`} onClick={() => setFilter(name)}>{name}</button>
            ))}
            {alertsAvailable ? <button type="button" className={ui.filterButton} onClick={enableAlerts}>Enable Alerts</button> : null}
          </div>
          <input className={ui.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes" />
        </div>

        {visibleItems.length === 0 ? (
          <div className={ui.empty}>No notes yet. Write one above.</div>
        ) : (
          <div className={ui.notesGrid}>
            {visibleItems.map((item) => {
              const dueAt = reminderTime(item);
              const overdue = Boolean(currentTime && dueAt && dueAt < currentTime && !item.completed);
              return (
                <article key={item.id} className={`${ui.noteCard} ${noteColorClass(item.color || "yellow")} ${item.completed ? ui.completedCard : ""}`}>
                  {item.title ? <h3 className={item.completed ? ui.completedText : ""}>{item.title}</h3> : null}
                  {item.details ? <p className={`${ui.noteText} ${item.completed ? ui.completedText : ""}`}>{item.details}</p> : null}
                  <div className={ui.noteBottom}>
                    {item.hasReminder ? (
                      <div className={`${ui.reminderBadge} ${overdue ? ui.overdueBadge : ""}`}>
                        🔔 {formatDisplayDate(item.date)} {item.time}
                      </div>
                    ) : null}
                    <div className={ui.cardActions} style={{ marginTop: 9 }}>
                      {item.hasReminder ? <button type="button" className={ui.smallButton} onClick={() => toggleCompleted(item.id)}>{item.completed ? "Reopen" : "Done"}</button> : null}
                      <button type="button" className={ui.smallButton} onClick={() => startEdit(item)}>Edit</button>
                      <button type="button" className={ui.dangerButton} onClick={() => remove(item.id)}>Delete</button>
                    </div>
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
