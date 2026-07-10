"use client";

import { FormEvent, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import ui from "@/components/MobileBusiness.module.css";
import {
  MOVEMENT_DESTINATIONS,
  STORAGE_KEYS,
  createMovementDraftRow,
  formatDateTime,
  makeId,
  nowLocalDateTime,
  type MovementDraftRow,
  type MovementRecord,
} from "@/lib/business-data";
import { useStoredList } from "@/lib/useStoredList";

type StageNumber = 1 | 2 | 3 | 4;
type HistoryFilter = "Active" | "Completed" | "All";
type StageEditor = {
  recordId: string;
  step: StageNumber;
  at: string;
  location: string;
  notes: string;
  finalAction: "Returned Home" | "Another Shop" | "Kept There" | "Not Returning";
  readOnly: boolean;
};

const LOCATION_CODES: Record<string, string> = {
  Karuvannur: "KVR",
  Ollur: "OLLR",
  Kachery: "KCH",
  "Mulayam Rd": "MLR",
  Pattikkad: "PTT",
  Brotech: "BRTC",
  "Siju Poochatty": "SJP",
  "Prijo Kachery": "PRJ",
  "MJ Tools": "MJ",
  Global: "GLBL",
  iBell: "IBELL",
  Vincent: "VINC",
  Other: "OTHER",
};

function makeRows(count = 8) {
  return Array.from({ length: count }, () => createMovementDraftRow());
}

function stageLabel(step: StageNumber) {
  if (step === 1) return "Picked";
  if (step === 2) return "Delivered";
  if (step === 3) return "Taken Back";
  return "Final";
}

function stageDetails(record: MovementRecord, step: StageNumber) {
  if (step === 1) return record.step1;
  if (step === 2) return record.step2;
  if (step === 3) return record.step3;
  return record.step4;
}

function shortLocation(location?: string) {
  const clean = location?.trim() || "";
  if (!clean) return "—";
  return LOCATION_CODES[clean] || clean;
}

function movementPath(record: MovementRecord) {
  const locations = ([1, 2, 3, 4] as StageNumber[])
    .map((step) => stageDetails(record, step)?.location?.trim())
    .filter((location): location is string => Boolean(location));

  return locations.length > 0 ? locations.join(" → ") : record.homeShop;
}

export default function ToolsMovementPage() {
  const { items, setItems } = useStoredList<MovementRecord>(STORAGE_KEYS.movements);
  const [rows, setRows] = useState<MovementDraftRow[]>(() => makeRows());
  const [showDrawer, setShowDrawer] = useState(false);
  const [editor, setEditor] = useState<StageEditor | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("Active");
  const [search, setSearch] = useState("");

  const activeItems = useMemo(
    () => items.filter((item) => item.stage < 4).sort((a, b) => b.updatedAt - a.updatedAt),
    [items]
  );

  const visibleHistory = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...items]
      .filter((item) => historyFilter === "All" || (historyFilter === "Active" ? item.stage < 4 : item.stage === 4))
      .filter((item) => {
        if (!query) return true;
        const text = [
          item.tool,
          item.homeShop,
          item.firstDestination,
          item.startNotes,
          item.step1.location,
          item.step1.notes,
          item.step2?.location,
          item.step2?.notes,
          item.step3?.location,
          item.step3?.notes,
          item.step4?.location,
          item.step4?.notes,
          item.step4?.finalAction,
        ].join(" ").toLowerCase();
        return text.includes(query);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [historyFilter, items, search]);

  function updateRow(id: string, patch: Partial<MovementDraftRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function startMovements(event: FormEvent) {
    event.preventDefault();
    const readyRows = rows.filter((row) => row.tool.trim());
    if (readyRows.length === 0) return;

    const now = Date.now();
    const startedAt = nowLocalDateTime();
    const newItems: MovementRecord[] = readyRows.map((row) => ({
      id: makeId("movement"),
      tool: row.tool.trim(),
      qty: 1,
      homeShop: row.homeShop,
      firstDestination: "",
      startNotes: row.notes.trim(),
      stage: 1,
      step1: {
        at: startedAt,
        location: row.homeShop,
        notes: row.notes.trim(),
      },
      createdAt: now,
      updatedAt: now,
    }));

    setItems((current) => [...newItems, ...current]);
    setRows(makeRows());
    setHistoryFilter("Active");
    setShowDrawer(true);
  }

  function openStage(record: MovementRecord, step: StageNumber) {
    const completed = step <= record.stage;
    const canEnter = step === record.stage + 1;
    if (!completed && !canEnter) return;

    const existing = stageDetails(record, step);
    const defaultLocation = step === 1
      ? record.homeShop
      : step === 2
        ? record.firstDestination
        : step === 3
          ? (record.step2?.location || record.firstDestination)
          : record.homeShop;

    setEditor({
      recordId: record.id,
      step,
      at: existing?.at || nowLocalDateTime(),
      location: existing?.location || defaultLocation || "",
      notes: existing?.notes || "",
      finalAction: step === 4 && record.step4?.finalAction ? record.step4.finalAction : "Returned Home",
      readOnly: completed,
    });
  }

  function saveStage(event: FormEvent) {
    event.preventDefault();
    if (!editor || editor.readOnly || !editor.location.trim()) return;

    setItems((current) => current.map((record) => {
      if (record.id !== editor.recordId) return record;
      const common = {
        at: editor.at || nowLocalDateTime(),
        location: editor.location.trim(),
        notes: editor.notes.trim(),
      };

      if (editor.step === 2) {
        return {
          ...record,
          firstDestination: common.location,
          stage: 2,
          step2: common,
          updatedAt: Date.now(),
        };
      }
      if (editor.step === 3) {
        return { ...record, stage: 3, step3: common, updatedAt: Date.now() };
      }
      if (editor.step === 4) {
        return {
          ...record,
          stage: 4,
          step4: { ...common, finalAction: editor.finalAction },
          updatedAt: Date.now(),
        };
      }
      return record;
    }));

    setEditor(null);
  }

  function removeRecord(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <AppShell title="Tools Movement" subtitle="Enter tools quickly, then move each one through four stops">
      <div className={ui.screen}>
        <div className={ui.movementTopActions}>
          <button type="button" className={ui.drawerOpenButton} onClick={() => setShowDrawer(true)}>
            Active Movements <span>{activeItems.length}</span>
          </button>
        </div>

        <form className={`${ui.panel} ${ui.movementEntryPanel}`} onSubmit={startMovements}>
          <div className={ui.movementHeader}>
            <div>
              <h2>Start Moving Tools</h2>
              <p>Tool, From and Note only. The first stage starts automatically.</p>
            </div>
          </div>

          <div className={ui.movementEntryTable}>
            {rows.map((row, index) => (
              <div className={ui.movementEntryRow} key={row.id}>
                <div className={ui.rowNumber}>{index + 1}</div>
                <input
                  className={`${ui.field} ${ui.movementToolField}`}
                  value={row.tool}
                  onChange={(event) => updateRow(row.id, { tool: event.target.value })}
                  placeholder="Tool"
                />
                <select
                  className={`${ui.select} ${ui.movementFromField}`}
                  value={row.homeShop}
                  onChange={(event) => updateRow(row.id, { homeShop: event.target.value })}
                  aria-label={`From location for row ${index + 1}`}
                >
                  {MOVEMENT_DESTINATIONS.map((location) => <option key={location}>{location}</option>)}
                </select>
                <input
                  className={`${ui.field} ${ui.movementNoteField}`}
                  value={row.notes}
                  onChange={(event) => updateRow(row.id, { notes: event.target.value })}
                  placeholder="Note"
                />
              </div>
            ))}
          </div>

          <button type="button" className={ui.addRowsButton} onClick={() => setRows((current) => [...current, ...makeRows()])}>+ Add 8 Rows</button>
          <button type="submit" className={ui.startMovementButton}>Start Movement</button>
        </form>

        <div className={ui.sectionBar}>
          <div className={ui.filterButtons}>
            {(["Active", "Completed", "All"] as const).map((name) => (
              <button key={name} type="button" className={`${ui.filterButton} ${historyFilter === name ? ui.filterButtonActive : ""}`} onClick={() => setHistoryFilter(name)}>{name}</button>
            ))}
          </div>
          <input className={ui.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tool or location" />
        </div>

        {visibleHistory.length === 0 ? (
          <div className={ui.empty}>No movement records found.</div>
        ) : (
          <div className={ui.movementHistoryList}>
            {visibleHistory.map((record) => (
              <article className={ui.movementHistoryCard} key={record.id}>
                <div className={ui.historyTitleRow}>
                  <div>
                    <h3>{record.tool}</h3>
                    <p>{movementPath(record)}</p>
                  </div>
                  <span className={`${ui.statusBadge} ${record.stage === 4 ? ui.completedStatus : ui.activeStatus}`}>
                    {record.stage === 4 ? "Completed" : `Stage ${record.stage}/4`}
                  </span>
                </div>
                <div className={ui.historySteps}>
                  {([1, 2, 3, 4] as StageNumber[]).map((step) => {
                    const detail = stageDetails(record, step);
                    return (
                      <button key={step} type="button" className={`${ui.historyStep} ${detail ? ui.historyStepDone : ""}`} onClick={() => detail ? openStage(record, step) : undefined}>
                        <b>{step}</b>
                        <span>{detail ? shortLocation(detail.location) : stageLabel(step)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className={ui.historyMeta}>
                  Started {formatDateTime(record.step1.at)}
                  {record.step4 ? ` · Finished ${formatDateTime(record.step4.at)}` : ""}
                </div>
                <div className={ui.cardActions}>
                  {record.stage < 4 ? <button type="button" className={ui.smallButton} onClick={() => setShowDrawer(true)}>Open Movements</button> : null}
                  <button type="button" className={ui.dangerButton} onClick={() => removeRecord(record.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showDrawer ? (
        <div className={ui.drawerBackdrop} onMouseDown={(event) => event.target === event.currentTarget && setShowDrawer(false)}>
          <section className={ui.activeDrawer} aria-label="Active movement drawer">
            <div className={ui.drawerHandle} />
            <div className={ui.drawerHeader}>
              <div>
                <h2>Active Tools</h2>
                <p>The large button shows where the tool is now. Tap the next faded button to continue.</p>
              </div>
              <button type="button" className={ui.drawerClose} onClick={() => setShowDrawer(false)}>×</button>
            </div>

            {activeItems.length === 0 ? (
              <div className={ui.empty}>No active tool movements.</div>
            ) : (
              <div className={ui.activeButtonRows}>
                {activeItems.map((record) => (
                  <div className={ui.activeButtonRow} key={record.id}>
                    {([1, 2, 3, 4] as StageNumber[]).map((step) => {
                      const isPast = step < record.stage;
                      const isCurrent = step === record.stage;
                      const isNext = step === record.stage + 1;
                      const isFuture = step > record.stage + 1;
                      const detail = stageDetails(record, step);
                      const currentLocation = detail?.location || record.homeShop;
                      const label = isCurrent
                        ? `${record.tool} • ${shortLocation(currentLocation)}`
                        : isPast
                          ? shortLocation(detail?.location)
                          : String(step);

                      return (
                        <button
                          key={step}
                          type="button"
                          className={`${ui.drawerStageButton} ${isPast ? ui.drawerStagePast : ""} ${isCurrent ? ui.drawerStageCurrent : ""} ${isNext ? ui.drawerStageNext : ""} ${isFuture ? ui.drawerStageFuture : ""}`}
                          disabled={isFuture}
                          onClick={() => openStage(record, step)}
                          title={isCurrent ? `${record.tool} is at ${detail?.location || record.homeShop}` : undefined}
                        >
                          <span className={ui.drawerStageText}>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {editor ? (
        <div className={ui.drawerBackdrop} onMouseDown={(event) => event.target === event.currentTarget && setEditor(null)}>
          <form className={ui.stageSheet} onSubmit={saveStage}>
            <div className={ui.drawerHandle} />
            <div className={ui.drawerHeader}>
              <div>
                <h2>{stageLabel(editor.step)}</h2>
                <p>{items.find((item) => item.id === editor.recordId)?.tool}</p>
              </div>
              <button type="button" className={ui.drawerClose} onClick={() => setEditor(null)}>×</button>
            </div>

            {editor.step === 4 ? (
              <div>
                <label className={ui.label}>Final Action</label>
                <div className={ui.finalActionGrid}>
                  {(["Returned Home", "Another Shop", "Kept There", "Not Returning"] as const).map((action) => (
                    <button
                      key={action}
                      type="button"
                      disabled={editor.readOnly}
                      className={`${ui.finalActionButton} ${editor.finalAction === action ? ui.finalActionActive : ""}`}
                      onClick={() => setEditor({ ...editor, finalAction: action })}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={ui.formStack}>
              <div>
                <label className={ui.label}>{editor.step === 2 ? "Delivered To" : editor.step === 3 ? "Collected From" : editor.step === 4 ? "Final Place" : "From"}</label>
                <input className={ui.field} value={editor.location} readOnly={editor.readOnly} onChange={(event) => setEditor({ ...editor, location: event.target.value })} placeholder="Location" />
              </div>
              <div>
                <label className={ui.label}>Date & Time</label>
                <input className={ui.dateInput} type="datetime-local" value={editor.at} readOnly={editor.readOnly} onChange={(event) => setEditor({ ...editor, at: event.target.value })} />
              </div>
              <div>
                <label className={ui.label}>Notes</label>
                <textarea className={ui.textarea} value={editor.notes} readOnly={editor.readOnly} onChange={(event) => setEditor({ ...editor, notes: event.target.value })} placeholder="Optional details" />
              </div>
            </div>

            <div className={ui.sheetActions}>
              <button type="button" className={ui.secondaryButton} onClick={() => setEditor(null)}>Close</button>
              {!editor.readOnly ? <button type="submit" className={ui.primaryButton}>Save Stage {editor.step}</button> : null}
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
