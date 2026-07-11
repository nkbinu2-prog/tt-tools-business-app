"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import AppShell from "@/components/AppShell";
import ui from "@/components/MobileBusiness.module.css";
import {
  STORAGE_KEYS,
  formatDisplayDate,
  makeId,
  todayIso,
  type NoteColor,
} from "@/lib/business-data";
import { useStoredList } from "@/lib/useStoredList";

type NoteMode = "checklist" | "text";

type ChecklistLine = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
};

type KeepNote = {
  kind: "keep-note";
  id: string;
  title: string;
  mode: NoteMode;
  text: string;
  items: ChecklistLine[];
  color: NoteColor;
  pinned: boolean;
  hasReminder: boolean;
  date: string;
  time: string;
  notifiedAt?: number;
  createdAt: number;
  updatedAt: number;
};

type LegacyRecord = {
  id?: string;
  title?: string;
  details?: string;
  text?: string;
  color?: NoteColor;
  completed?: boolean;
  hasReminder?: boolean;
  date?: string;
  time?: string;
  notifiedAt?: number;
  createdAt?: number;
  updatedAt?: number;
};

type StoredRecord = KeepNote | LegacyRecord;

const noteColors: NoteColor[] = ["white", "yellow", "blue", "green", "pink"];

function isKeepNote(record: StoredRecord): record is KeepNote {
  return (
    "kind" in record &&
    record.kind === "keep-note" &&
    Array.isArray((record as KeepNote).items)
  );
}

function makeLine(text = ""): ChecklistLine {
  const now = Date.now();

  return {
    id: makeId("line"),
    text,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
}

function makeNote(mode: NoteMode = "checklist"): KeepNote {
  const now = Date.now();

  return {
    kind: "keep-note",
    id: makeId("note"),
    title: "",
    mode,
    text: "",
    items: mode === "checklist" ? [makeLine()] : [],
    color: "white",
    pinned: false,
    hasReminder: false,
    date: todayIso(),
    time: "09:00",
    createdAt: now,
    updatedAt: now,
  };
}

function migrateRecord(record: StoredRecord, index: number): KeepNote {
  if (isKeepNote(record)) {
    return {
      ...record,
      title: record.title ?? "",
      text: record.text ?? "",
      items:
        record.mode === "checklist" && record.items.length === 0
          ? [makeLine()]
          : record.items,
      color: record.color || "white",
      pinned: Boolean(record.pinned),
      hasReminder: Boolean(record.hasReminder),
      date: record.date || todayIso(),
      time: record.time || "09:00",
    };
  }

  const now = Date.now();
  const legacy = record as LegacyRecord;
  const title = String(legacy.title ?? "");
  const details = String(legacy.details ?? legacy.text ?? "");

  return {
    kind: "keep-note",
    id: legacy.id || `legacy-note-${index}`,
    title,
    mode: "text",
    text: details || (!title ? "New note" : ""),
    items: [],
    color: legacy.color || "white",
    pinned: false,
    hasReminder: Boolean(legacy.hasReminder),
    date: legacy.date || todayIso(),
    time: legacy.time || "09:00",
    notifiedAt: legacy.notifiedAt,
    createdAt: legacy.createdAt || now,
    updatedAt: legacy.updatedAt || now,
  };
}

function noteColorClass(color: NoteColor) {
  return color === "blue"
    ? ui.colorBlue
    : color === "green"
      ? ui.colorGreen
      : color === "pink"
        ? ui.colorPink
        : color === "yellow"
          ? ui.colorYellow
          : ui.colorWhite;
}

function reminderTime(note: KeepNote) {
  if (!note.hasReminder || !note.date) return null;
  return new Date(`${note.date}T${note.time || "00:00"}:00`).getTime();
}

function focusElement(id: string) {
  window.requestAnimationFrame(() => {
    document.getElementById(id)?.focus();
  });
}

export default function RemindersPage() {
  const { items, setItems } = useStoredList<StoredRecord>(
    STORAGE_KEYS.reminders
  );

  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [paletteNoteId, setPaletteNoteId] = useState<string | null>(null);
  const [reminderNoteId, setReminderNoteId] = useState<string | null>(null);
  const [alertsAvailable, setAlertsAvailable] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const notes = useMemo(
    () => items.map((record, index) => migrateRecord(record, index)),
    [items]
  );

  useEffect(() => {
    if (items.some((record) => !isKeepNote(record))) {
      setItems((current) =>
        current.map((record, index) => migrateRecord(record, index))
      );
    }
  }, [items, setItems]);

  useEffect(() => {
    const refreshClientState = () => {
      setCurrentTime(Date.now());
      setAlertsAvailable(
        typeof Notification !== "undefined" &&
          Notification.permission !== "granted"
      );
    };

    refreshClientState();
    const timer = window.setInterval(refreshClientState, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined") return;

    const now = Date.now();
    const dueNotes = notes.filter((note) => {
      const dueAt = reminderTime(note);

      return (
        note.hasReminder &&
        !note.notifiedAt &&
        dueAt !== null &&
        dueAt <= now
      );
    });

    if (dueNotes.length === 0) return;

    if (Notification.permission === "granted") {
      dueNotes.forEach((note) => {
        new Notification(note.title || "T&T Tools Reminder", {
          body:
            note.mode === "text"
              ? note.text || "Reminder time reached"
              : note.items.find((item) => item.text.trim())?.text ||
                "Reminder time reached",
          icon: "/tt-logo.png",
        });
      });
    }

    const dueIds = new Set(dueNotes.map((note) => note.id));

    setItems((current) =>
      current
        .map((record, index) => migrateRecord(record, index))
        .map((note) =>
          dueIds.has(note.id) ? { ...note, notifiedAt: now } : note
        )
    );
  }, [currentTime, notes, setItems]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return notes
      .filter((note) => {
        if (!query) return true;

        const checklistText = note.items
          .map((item) => item.text)
          .join(" ");

        return `${note.title} ${note.text} ${checklistText}`
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
        return b.updatedAt - a.updatedAt;
      });
  }, [notes, search]);

  const pinnedNotes = filteredNotes.filter((note) => note.pinned);
  const otherNotes = filteredNotes.filter((note) => !note.pinned);

  function updateNotes(mutator: (current: KeepNote[]) => KeepNote[]) {
    setItems((current) =>
      mutator(
        current.map((record, index) => migrateRecord(record, index))
      )
    );
  }

  function updateNote(
    noteId: string,
    patch: Partial<Omit<KeepNote, "id" | "kind">>
  ) {
    updateNotes((current) =>
      current.map((note) =>
        note.id === noteId
          ? { ...note, ...patch, updatedAt: Date.now() }
          : note
      )
    );
  }

  function createNote(mode: NoteMode = "checklist") {
    const note = makeNote(mode);

    updateNotes((current) => [note, ...current]);
    setOpenMenuId(null);
    setPaletteNoteId(null);
    setReminderNoteId(null);

    focusElement(`note-title-${note.id}`);
  }

  function duplicateNote(note: KeepNote) {
    const now = Date.now();
    const copy: KeepNote = {
      ...note,
      id: makeId("note"),
      title: note.title ? `${note.title} copy` : "",
      pinned: false,
      notifiedAt: undefined,
      items: note.items.map((item) => ({
        ...item,
        id: makeId("line"),
        createdAt: now,
        updatedAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    };

    updateNotes((current) => [copy, ...current]);
    setOpenMenuId(null);
    focusElement(`note-title-${copy.id}`);
  }

  function deleteNote(noteId: string) {
    if (!window.confirm("Delete this note?")) return;

    updateNotes((current) => current.filter((note) => note.id !== noteId));
    setOpenMenuId(null);
    setPaletteNoteId(null);
    setReminderNoteId(null);
  }

  function updateLineText(noteId: string, lineId: string, text: string) {
    updateNotes((current) =>
      current.map((note) =>
        note.id === noteId
          ? {
              ...note,
              items: note.items.map((item) =>
                item.id === lineId
                  ? { ...item, text, updatedAt: Date.now() }
                  : item
              ),
              updatedAt: Date.now(),
            }
          : note
      )
    );
  }

  function insertLineAfter(noteId: string, lineId: string) {
    const newLine = makeLine();

    updateNotes((current) =>
      current.map((note) => {
        if (note.id !== noteId) return note;

        const sourceIndex = note.items.findIndex((item) => item.id === lineId);
        const nextItems = [...note.items];
        nextItems.splice(
          sourceIndex >= 0 ? sourceIndex + 1 : nextItems.length,
          0,
          newLine
        );

        return {
          ...note,
          items: nextItems,
          updatedAt: Date.now(),
        };
      })
    );

    focusElement(`line-${newLine.id}`);
  }

  function removeEmptyLine(noteId: string, lineId: string) {
    const note = notes.find((item) => item.id === noteId);
    if (!note || note.items.length <= 1) return;

    const index = note.items.findIndex((item) => item.id === lineId);
    const previous = note.items[Math.max(0, index - 1)];

    updateNotes((current) =>
      current.map((item) =>
        item.id === noteId
          ? {
              ...item,
              items: item.items.filter((line) => line.id !== lineId),
              updatedAt: Date.now(),
            }
          : item
      )
    );

    if (previous) focusElement(`line-${previous.id}`);
  }

  function handleLineKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    note: KeepNote,
    line: ChecklistLine
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!line.text.trim()) return;
      insertLineAfter(note.id, line.id);
      return;
    }

    if (event.key === "Backspace" && !line.text) {
      event.preventDefault();
      removeEmptyLine(note.id, line.id);
    }
  }

  function toggleLine(noteId: string, lineId: string) {
    updateNotes((current) =>
      current.map((note) =>
        note.id === noteId
          ? {
              ...note,
              items: note.items.map((item) =>
                item.id === lineId
                  ? {
                      ...item,
                      completed: !item.completed,
                      updatedAt: Date.now(),
                    }
                  : item
              ),
              updatedAt: Date.now(),
            }
          : note
      )
    );
  }

  function changeMode(note: KeepNote) {
    if (note.mode === "checklist") {
      const ordered = [
        ...note.items.filter((item) => !item.completed),
        ...note.items.filter((item) => item.completed),
      ];

      updateNote(note.id, {
        mode: "text",
        text: ordered.map((item) => item.text).join("\n"),
      });
    } else {
      const lines = note.text
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.trim());

      updateNote(note.id, {
        mode: "checklist",
        items: lines.length > 0 ? lines.map((line) => makeLine(line)) : [makeLine()],
      });
    }

    setOpenMenuId(null);
  }

  function saveReminder(event: FormEvent, note: KeepNote) {
    event.preventDefault();

    updateNote(note.id, {
      hasReminder: true,
      date: note.date || todayIso(),
      time: note.time || "09:00",
      notifiedAt: undefined,
    });

    setReminderNoteId(null);
  }

  function removeReminder(noteId: string) {
    updateNote(noteId, {
      hasReminder: false,
      notifiedAt: undefined,
    });
    setReminderNoteId(null);
  }

  async function enableAlerts() {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setAlertsAvailable(permission !== "granted");
  }

  function renderNote(note: KeepNote) {
    const activeItems = note.items.filter((item) => !item.completed);
    const completedItems = note.items.filter((item) => item.completed);
    const dueAt = reminderTime(note);
    const overdue = Boolean(
      currentTime && dueAt && dueAt < currentTime && !note.notifiedAt
    );

    return (
      <article
        key={note.id}
        className={`${ui.boardNoteCard} ${noteColorClass(note.color)}`}
      >
        <div className={ui.boardNoteHeader}>
          <input
            id={`note-title-${note.id}`}
            className={ui.boardNoteTitle}
            value={note.title}
            onChange={(event) =>
              updateNote(note.id, { title: event.target.value })
            }
            placeholder="Title"
          />

          <div className={ui.boardHeaderActions}>
            <button
              type="button"
              className={`${ui.boardPinButton} ${
                note.pinned ? ui.boardPinActive : ""
              }`}
              onClick={() => updateNote(note.id, { pinned: !note.pinned })}
              aria-label={note.pinned ? "Unpin note" : "Pin note"}
              title={note.pinned ? "Unpin note" : "Pin note"}
            >
              📌
            </button>

            <div className={ui.boardMenuWrap}>
              <button
                type="button"
                className={ui.boardMoreButton}
                onClick={() =>
                  setOpenMenuId((current) =>
                    current === note.id ? null : note.id
                  )
                }
                aria-label="More options"
              >
                ⋮
              </button>

              {openMenuId === note.id ? (
                <div className={ui.boardMenu}>
                  <button
                    type="button"
                    onClick={() => updateNote(note.id, { pinned: !note.pinned })}
                  >
                    {note.pinned ? "Unpin note" : "Pin note"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReminderNoteId(note.id);
                      setOpenMenuId(null);
                    }}
                  >
                    {note.hasReminder ? "Edit reminder" : "Add reminder"}
                  </button>
                  <button type="button" onClick={() => changeMode(note)}>
                    {note.mode === "checklist"
                      ? "Hide tick boxes"
                      : "Show tick boxes"}
                  </button>
                  <button type="button" onClick={() => duplicateNote(note)}>
                    Make a copy
                  </button>
                  <button
                    type="button"
                    className={ui.boardDeleteMenuItem}
                    onClick={() => deleteNote(note.id)}
                  >
                    Delete note
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {note.mode === "checklist" ? (
          <div className={ui.boardChecklist}>
            {activeItems.map((line) => (
              <div className={ui.boardChecklistRow} key={line.id}>
                <button
                  type="button"
                  className={ui.boardCheckbox}
                  onClick={() => toggleLine(note.id, line.id)}
                  aria-label="Mark item done"
                />
                <input
                  id={`line-${line.id}`}
                  value={line.text}
                  onChange={(event) =>
                    updateLineText(note.id, line.id, event.target.value)
                  }
                  onKeyDown={(event) =>
                    handleLineKeyDown(event, note, line)
                  }
                  placeholder="List item"
                />
              </div>
            ))}

            {completedItems.length > 0 ? (
              <div className={ui.boardCompletedGroup}>
                {completedItems.map((line) => (
                  <div
                    className={`${ui.boardChecklistRow} ${ui.boardChecklistRowDone}`}
                    key={line.id}
                  >
                    <button
                      type="button"
                      className={`${ui.boardCheckbox} ${ui.boardCheckboxDone}`}
                      onClick={() => toggleLine(note.id, line.id)}
                      aria-label="Mark item active"
                    >
                      ✓
                    </button>
                    <input
                      id={`line-${line.id}`}
                      value={line.text}
                      onChange={(event) =>
                        updateLineText(note.id, line.id, event.target.value)
                      }
                      onKeyDown={(event) =>
                        handleLineKeyDown(event, note, line)
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <textarea
            className={ui.boardPlainText}
            value={note.text}
            onChange={(event) =>
              updateNote(note.id, { text: event.target.value })
            }
            placeholder="Write a note..."
          />
        )}

        {reminderNoteId === note.id ? (
          <form
            className={ui.boardReminderEditor}
            onSubmit={(event) => saveReminder(event, note)}
          >
            <input
              type="date"
              value={note.date || todayIso()}
              onChange={(event) =>
                updateNote(note.id, { date: event.target.value })
              }
            />
            <input
              type="time"
              value={note.time || "09:00"}
              onChange={(event) =>
                updateNote(note.id, { time: event.target.value })
              }
            />
            <button type="submit">Save</button>
            {note.hasReminder ? (
              <button
                type="button"
                onClick={() => removeReminder(note.id)}
              >
                Remove
              </button>
            ) : null}
          </form>
        ) : null}

        <footer className={ui.boardNoteFooter}>
          <div className={ui.boardFooterLeft}>
            {note.hasReminder ? (
              <button
                type="button"
                className={`${ui.boardReminderChip} ${
                  overdue ? ui.boardReminderOverdue : ""
                }`}
                onClick={() => setReminderNoteId(note.id)}
              >
                🔔 {formatDisplayDate(note.date)} {note.time}
              </button>
            ) : null}
          </div>

          <div className={ui.boardFooterActions}>
            <button
              type="button"
              onClick={() =>
                setPaletteNoteId((current) =>
                  current === note.id ? null : note.id
                )
              }
              aria-label="Change note colour"
              title="Change colour"
            >
              🎨
            </button>
            <button
              type="button"
              onClick={() =>
                setOpenMenuId((current) =>
                  current === note.id ? null : note.id
                )
              }
              aria-label="More options"
              title="More options"
            >
              ⋮
            </button>
          </div>
        </footer>

        {paletteNoteId === note.id ? (
          <div className={ui.boardPalette}>
            {noteColors.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`${color} note`}
                className={`${ui.boardPaletteColor} ${noteColorClass(color)} ${
                  note.color === color ? ui.boardPaletteSelected : ""
                }`}
                onClick={() => {
                  updateNote(note.id, { color });
                  setPaletteNoteId(null);
                }}
              />
            ))}
          </div>
        ) : null}
      </article>
    );
  }

  function renderSection(title: string, sectionNotes: KeepNote[]) {
    if (sectionNotes.length === 0) return null;

    return (
      <section className={ui.boardSection}>
        <div className={ui.boardSectionTitle}>{title}</div>
        <div className={ui.boardMasonry}>{sectionNotes.map(renderNote)}</div>
      </section>
    );
  }

  return (
    <AppShell
      title="Notes & Reminders"
      subtitle="Multiple notes, checklists and reminders"
    >
      <div className={`${ui.screen} ${ui.boardScreen}`}>
        <div className={ui.boardTopbar}>
          <div className={ui.boardSearch}>
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes"
            />
          </div>

          <button
            type="button"
            className={ui.boardNewButton}
            onClick={() => createNote("checklist")}
          >
            ＋ New note
          </button>

          {alertsAvailable ? (
            <button
              type="button"
              className={ui.boardAlertButton}
              onClick={enableAlerts}
            >
              Enable alerts
            </button>
          ) : null}
        </div>

        {notes.length === 0 ? (
          <button
            type="button"
            className={ui.boardEmpty}
            onClick={() => createNote("checklist")}
          >
            <strong>Create your first note</strong>
            <span>
              Type directly inside the card. Press Enter for the next checkbox.
            </span>
          </button>
        ) : (
          <>
            {renderSection("PINNED", pinnedNotes)}
            {renderSection(pinnedNotes.length > 0 ? "OTHERS" : "NOTES", otherNotes)}
          </>
        )}
      </div>
    </AppShell>
  );
}
