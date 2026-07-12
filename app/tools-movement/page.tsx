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
    .filter((location): location is string => Boolean(location))
    .map(shortLocation);

  return locations.length > 0
    ? locations.join(" → ")
    : shortLocation(record.homeShop);
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
      <div className={`${ui.screen} tools-movement-font-120`}>
        <div className={ui.movementTopActions}>
          <button type="button" className={`${ui.drawerOpenButton} tm-drawer-open`} onClick={() => setShowDrawer(true)}>
            Active Movements <span>{activeItems.length}</span>
          </button>
        </div>

        <form className={`${ui.panel} ${ui.movementEntryPanel}`} onSubmit={startMovements}>
          <div className={ui.movementHeader}>
            <div>
              <h2 className="tm-heading">Start Moving Tools</h2>
              <p className="tm-subtext">Tool, From and Note only. The first stage starts automatically.</p>
            </div>
          </div>

          <div className={ui.movementEntryTable}>
            {rows.map((row, index) => (
              <div className={ui.movementEntryRow} key={row.id}>
                <div className={ui.rowNumber}>{index + 1}</div>
                <input
                  className={`${ui.field} ${ui.movementToolField} tm-entry-field`}
                  value={row.tool}
                  onChange={(event) => updateRow(row.id, { tool: event.target.value })}
                  placeholder="Tool"
                />
                <select
                  className={`${ui.select} ${ui.movementFromField} tm-entry-field`}
                  value={row.homeShop}
                  onChange={(event) => updateRow(row.id, { homeShop: event.target.value })}
                  aria-label={`From location for row ${index + 1}`}
                >
                  {MOVEMENT_DESTINATIONS.map((location) => <option key={location}>{location}</option>)}
                </select>
                <input
                  className={`${ui.field} ${ui.movementNoteField} tm-entry-field`}
                  value={row.notes}
                  onChange={(event) => updateRow(row.id, { notes: event.target.value })}
                  placeholder="Note"
                />
              </div>
            ))}
          </div>

          <button type="button" className={`${ui.addRowsButton} tm-main-action`} onClick={() => setRows((current) => [...current, ...makeRows()])}>+ Add 8 Rows</button>
          <button type="submit" className={`${ui.startMovementButton} tm-main-action`}>Start Movement</button>
        </form>

        <div className={ui.sectionBar}>
          <div className={ui.filterButtons}>
            {(["Active", "Completed", "All"] as const).map((name) => (
              <button key={name} type="button" className={`${ui.filterButton} tm-filter-button ${historyFilter === name ? ui.filterButtonActive : ""}`} onClick={() => setHistoryFilter(name)}>{name}</button>
            ))}
          </div>
          <input className={`${ui.searchInput} tm-search-input`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tool or location" />
        </div>

        {visibleHistory.length === 0 ? (
          <div className={ui.empty}>No movement records found.</div>
        ) : (
          <div className="movementTextList">
            {visibleHistory.map((record) => (
              <div className="movementTextRow" key={record.id}>
                <button
                  type="button"
                  className="movementTextMain"
                  onClick={() => {
                    if (record.stage < 4) setShowDrawer(true);
                  }}
                  title={
                    record.stage < 4
                      ? "Open active movement"
                      : `${record.tool} • ${movementPath(record)}`
                  }
                >
                  <strong>{record.tool}</strong>
                  <span className="movementTextPath">
                    {movementPath(record)}
                  </span>
                  <span
                    className={
                      record.stage === 4
                        ? "movementTextStatus completed"
                        : "movementTextStatus active"
                    }
                  >
                    {record.stage === 4
                      ? "Completed"
                      : `Active ${record.stage}/4`}
                  </span>
                  <span className="movementTextDate">
                    {record.step4
                      ? formatDateTime(record.step4.at)
                      : formatDateTime(record.step1.at)}
                  </span>
                </button>

                <button
                  type="button"
                  className="movementTextDelete"
                  onClick={() => removeRecord(record.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDrawer ? (
        <div className={ui.drawerBackdrop} onMouseDown={(event) => event.target === event.currentTarget && setShowDrawer(false)}>
          <section className={`${ui.activeDrawer} tm-drawer`} aria-label="Active movement drawer">
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
                          className={`${ui.drawerStageButton} tm-stage-button ${isPast ? ui.drawerStagePast : ""} ${isCurrent ? ui.drawerStageCurrent : ""} ${isNext ? ui.drawerStageNext : ""} ${isFuture ? ui.drawerStageFuture : ""}`}
                          disabled={isFuture}
                          onClick={() => openStage(record, step)}
                          title={isCurrent ? `${record.tool} is at ${detail?.location || record.homeShop}` : undefined}
                        >
                          <span className={`${ui.drawerStageText} tm-stage-text`}>{label}</span>
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

      <style jsx global>{`
        .tools-movement-font-120 {
          font-weight: 600;
        }

        .tools-movement-font-120 .tm-heading {
          font-size: 21.6px !important;
          font-weight: 800 !important;
        }

        .tools-movement-font-120 .tm-subtext {
          font-size: 14.4px !important;
          font-weight: 600 !important;
        }

        .tools-movement-font-120 .tm-entry-field {
          font-size: 14.4px !important;
          font-weight: 700 !important;
        }

        .tools-movement-font-120 .tm-drawer-open {
          font-size: 15.6px !important;
          font-weight: 900 !important;
        }

        .tools-movement-font-120 .tm-main-action,
        .tools-movement-font-120 .tm-filter-button,
        .tools-movement-font-120 .tm-search-input {
          font-size: 16.8px !important;
          font-weight: 800 !important;
        }

        .tm-drawer,
        .tm-stage-sheet {
          font-weight: 600;
        }

        .tm-stage-text {
          font-size: 120% !important;
          font-weight: 700 !important;
        }

        .tm-label {
          font-size: 120% !important;
          font-weight: 800 !important;
        }

        .tm-sheet-field,
        .tm-sheet-textarea,
        .tm-sheet-button {
          font-size: 120% !important;
          font-weight: 700 !important;
        }

        @media (max-width: 760px) {
          .tools-movement-font-120 .tm-entry-field {
            font-size: 12px !important;
          }

          .tools-movement-font-120 .tm-main-action,
          .tools-movement-font-120 .tm-filter-button,
          .tools-movement-font-120 .tm-search-input {
            font-size: 12px !important;
          }

          .tools-movement-font-120 .tm-heading {
            font-size: 21.6px !important;
          }

          .tools-movement-font-120 .tm-subtext {
            font-size: 12px !important;
          }
        }

        @media (max-width: 390px) {
          .tools-movement-font-120 .tm-entry-field {
            font-size: 10.8px !important;
          }

          .tools-movement-font-120 .tm-main-action,
          .tools-movement-font-120 .tm-filter-button,
          .tools-movement-font-120 .tm-search-input {
            font-size: 10.8px !important;
          }
        }

        @media (max-width: 340px) {
          .tools-movement-font-120 .tm-entry-field {
            font-size: 10.2px !important;
          }
        }

        .movementTextList {
          border-top: 1px solid #d1d5db;
          background: #ffffff;
        }

        .movementTextRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          min-height: 34px;
          border-bottom: 1px solid #d1d5db;
          background: #ffffff;
        }

        .movementTextMain {
          min-width: 0;
          height: 33px;
          display: grid;
          grid-template-columns:
            minmax(70px, 1.2fr)
            minmax(90px, 1.8fr)
            auto
            auto;
          align-items: center;
          gap: 7px;
          border: 0;
          background: transparent;
          color: #374151;
          padding: 0 7px;
          text-align: left;
          cursor: pointer;
        }

        .movementTextMain strong,
        .movementTextMain span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .movementTextMain strong {
          color: #111827;
          font-size: 12px;
          font-weight: 800;
        }

        .movementTextPath {
          color: #4b5563;
          font-size: 10.8px;
          font-weight: 600;
        }

        .movementTextStatus {
          font-size: 9.6px;
          font-weight: 800;
          white-space: nowrap;
        }

        .movementTextStatus.active {
          color: #075985;
        }

        .movementTextStatus.completed {
          color: #087a2b;
        }

        .movementTextDate {
          color: #6b7280;
          font-size: 9.6px;
          font-weight: 600;
        }

        .movementTextDelete {
          height: 25px;
          margin-right: 4px;
          border: 0;
          border-radius: 5px;
          background: #fff0f0;
          color: #c80000;
          padding: 0 6px;
          font-size: 9.6px;
          font-weight: 800;
          cursor: pointer;
        }

        @media (max-width: 640px) {
          .movementTextMain {
            grid-template-columns:
              minmax(62px, 1.1fr)
              minmax(70px, 1.6fr)
              auto;
            gap: 4px;
            padding-left: 4px;
            padding-right: 4px;
          }

          .movementTextDate {
            display: none;
          }

          .movementTextMain strong {
            font-size: 10.8px;
          }

          .movementTextPath {
            font-size: 9.6px;
          }

          .movementTextStatus,
          .movementTextDelete {
            font-size: 9px;
          }
        }
      `}</style>

      {editor ? (
        <div className={ui.drawerBackdrop} onMouseDown={(event) => event.target === event.currentTarget && setEditor(null)}>
          <form className={`${ui.stageSheet} tm-stage-sheet`} onSubmit={saveStage}>
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
                <label className={`${ui.label} tm-label`}>Final Action</label>
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
                <label className={`${ui.label} tm-label`}>{editor.step === 2 ? "Delivered To" : editor.step === 3 ? "Collected From" : editor.step === 4 ? "Final Place" : "From"}</label>
                <input className={`${ui.field} tm-sheet-field`} value={editor.location} readOnly={editor.readOnly} onChange={(event) => setEditor({ ...editor, location: event.target.value })} placeholder="Location" />
              </div>
              <div>
                <label className={`${ui.label} tm-label`}>Date & Time</label>
                <input className={`${ui.dateInput} tm-sheet-field`} type="datetime-local" value={editor.at} readOnly={editor.readOnly} onChange={(event) => setEditor({ ...editor, at: event.target.value })} />
              </div>
              <div>
                <label className={`${ui.label} tm-label`}>Notes</label>
                <textarea className={`${ui.textarea} tm-sheet-textarea`} value={editor.notes} readOnly={editor.readOnly} onChange={(event) => setEditor({ ...editor, notes: event.target.value })} placeholder="Optional details" />
              </div>
            </div>

            <div className={ui.sheetActions}>
              <button type="button" className={`${ui.secondaryButton} tm-sheet-button`} onClick={() => setEditor(null)}>Close</button>
              {!editor.readOnly ? <button type="submit" className={`${ui.primaryButton} tm-sheet-button`}>Save Stage {editor.step}</button> : null}
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
