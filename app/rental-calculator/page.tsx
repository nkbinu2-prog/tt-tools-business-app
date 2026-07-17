"use client";

import html2canvas from "html2canvas";
import AppShell from "../../components/AppShell";
import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type Row = {
  tool: string;
  qty: string;
  rent: string;
  sundayOff: boolean;
  from: string;
  to: string;
};

const branches = [
  {
    name: "KARUVANNUR",
    address: "Near St. Marys Church, Karuvannur, Thrissur.",
    mob: "6282778096",
  },
  {
    name: "OLLUR",
    address: "Gramodharanam Rd, Ollur, Thrissur.",
    mob: "8589874904",
  },
  {
    name: "KACHERY",
    address: "Kachery Centre, Kachery, Thrissur.",
    mob: "9744774904",
  },
  {
    name: "MULAYAM",
    address: "Mulayam Jn, Mulayam Rd, Thrissur.",
    mob: "8086774904",
  },
  {
    name: "PATTIKKAD",
    address: "Peechi Rd, Pattikkad, Thrissur.",
    mob: "9539712465",
  },
];

const emptyRow = (): Row => ({
  tool: "",
  qty: "",
  rent: "",
  sundayOff: true,
  from: "",
  to: "",
});

const createRows = (count: number) =>
  Array.from({ length: count }, () => emptyRow());

function rowHasData(row: Row) {
  return Boolean(row.tool || row.qty || row.rent || row.from || row.to);
}

function formatDate(value: string) {
  if (!value) return "";

  const date = new Date(value + "T00:00:00");

  const days = ["ഞായർ", "തിങ്കൾ", "ചൊവ്വ", "ബുധൻ", "വ്യാഴം", "വെള്ളി", "ശനി"];

  const months = [
    "ജനുവരി",
    "ഫെബ്രുവരി",
    "മാർച്ച്",
    "ഏപ്രിൽ",
    "മെയ്",
    "ജൂൺ",
    "ജൂലൈ",
    "ഓഗസ്റ്റ്",
    "സെപ്റ്റംബർ",
    "ഒക്ടോബർ",
    "നവംബർ",
    "ഡിസംബർ",
  ];

  return `${days[date.getDay()]} | ${date.getDate()} ${months[date.getMonth()]}`;
}

function todayText() {
  const d = new Date();
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function billFileName(customerName: string) {
  const d = new Date();
  const date = [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join("-");

  const safeCustomerName = customerName
    .trim()
    .replace(/[\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ");

  return `T&T Tools Rental ${safeCustomerName} ${date}.jpg`;
}

function countSundays(from: Date, to: Date) {
  let count = 0;
  const d = new Date(from);

  while (d <= to) {
    if (d.getDay() === 0) count++;
    d.setDate(d.getDate() + 1);
  }

  return count;
}

function getDays(from: string, to: string, sundayOff: boolean) {
  if (!from || !to) return 0;

  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");

  if (end < start) return 0;

  const totalDays =
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return sundayOff
    ? Math.max(totalDays - countSundays(start, end), 0)
    : totalDays;
}

function formatMoney(value: number) {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}


type SavedDraft = {
  id: string;
  customerName: string;
  transportCost?: string;
  discount: string;
  rows: Row[];
  updatedAt: number;
};

const DB_NAME = "tt-rental-calculator-db";
const DB_VERSION = 1;
const DRAFT_STORE = "drafts";
const CURRENT_DRAFT_ID = "__current__";

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putDraft(draft: SavedDraft) {
  const db = await openDraftDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, "readwrite");
    tx.objectStore(DRAFT_STORE).put(draft);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getDraft(id: string): Promise<SavedDraft | null> {
  const db = await openDraftDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, "readonly");
    const request = tx.objectStore(DRAFT_STORE).get(id);
    request.onsuccess = () => resolve((request.result as SavedDraft) || null);
    request.onerror = () => reject(request.error);
  });
}

async function getAllSavedDrafts(): Promise<SavedDraft[]> {
  const db = await openDraftDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, "readonly");
    const request = tx.objectStore(DRAFT_STORE).getAll();
    request.onsuccess = () => {
      const drafts = ((request.result as SavedDraft[]) || [])
        .filter((draft) => draft.id !== CURRENT_DRAFT_ID)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(drafts);
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteDraftById(id: string) {
  const db = await openDraftDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, "readwrite");
    tx.objectStore(DRAFT_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function makeDraftId(name: string) {
  const cleanName = name.trim().toLowerCase();
  return cleanName || CURRENT_DRAFT_ID;
}

function hasUsefulData(
  customerName: string,
  rows: Row[],
  transportCost: string,
  discount: string
) {
  return Boolean(
    customerName.trim() ||
      transportCost.trim() ||
      discount.trim() ||
      rows.some((row) => row.tool || row.qty || row.rent || row.from || row.to)
  );
}

export default function Home() {
  const [customerName, setCustomerName] = useState("");
  const [transportCost, setTransportCost] = useState("");
  const [discount, setDiscount] = useState("");
  const [rows, setRows] = useState<Row[]>(createRows(10));
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [draftSearch, setDraftSearch] = useState("");
  const [showDrafts, setShowDrafts] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Ready");
  const [loadedFromDb, setLoadedFromDb] = useState(false);
  const [qrSrc, setQrSrc] = useState("/gpay-qr.png");
  const [draggingRowIndex, setDraggingRowIndex] = useState<number | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);

  const billRef = useRef<HTMLDivElement | null>(null);
  const dragSourceIndexRef = useRef<number | null>(null);
  const dragTargetIndexRef = useRef<number | null>(null);

  function updateRow(index: number, field: keyof Row, value: string | boolean) {
    const copy = [...rows];
    copy[index] = { ...copy[index], [field]: value };
    setRows(copy);
  }

  function addRows() {
    setRows([...rows, ...createRows(5)]);
  }

  function copyRowBelow(index: number) {
    setRows((currentRows) => {
      const sourceRow = currentRows[index];
      if (!sourceRow) return currentRows;

      const copiedRow = { ...sourceRow };
      const nextIndex = index + 1;
      const updatedRows = [...currentRows];

      if (nextIndex < updatedRows.length && !rowHasData(updatedRows[nextIndex])) {
        updatedRows[nextIndex] = copiedRow;
      } else {
        updatedRows.splice(nextIndex, 0, copiedRow);
      }

      return updatedRows;
    });
  }

  function startRowDrag(
    event: PointerEvent<HTMLButtonElement>,
    index: number
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragSourceIndexRef.current = index;
    dragTargetIndexRef.current = index;
    setDraggingRowIndex(index);
    setDragOverRowIndex(index);
  }

  function continueRowDrag(event: PointerEvent<HTMLButtonElement>) {
    if (dragSourceIndexRef.current === null) return;

    event.preventDefault();
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const rowElement = element?.closest<HTMLTableRowElement>(
      "tr[data-row-index]"
    );

    if (!rowElement) return;

    const targetIndex = Number(rowElement.dataset.rowIndex);
    if (!Number.isInteger(targetIndex)) return;

    dragTargetIndexRef.current = targetIndex;
    setDragOverRowIndex(targetIndex);
  }

  function finishRowDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const sourceIndex = dragSourceIndexRef.current;
    const targetIndex = dragTargetIndexRef.current;

    if (
      sourceIndex !== null &&
      targetIndex !== null &&
      sourceIndex !== targetIndex
    ) {
      setRows((currentRows) => {
        const updatedRows = [...currentRows];
        const [movedRow] = updatedRows.splice(sourceIndex, 1);
        updatedRows.splice(targetIndex, 0, movedRow);
        return updatedRows;
      });
    }

    dragSourceIndexRef.current = null;
    dragTargetIndexRef.current = null;
    setDraggingRowIndex(null);
    setDragOverRowIndex(null);
  }

  function cancelRowDrag() {
    dragSourceIndexRef.current = null;
    dragTargetIndexRef.current = null;
    setDraggingRowIndex(null);
    setDragOverRowIndex(null);
  }

  function clearAll() {
    if (confirm("എല്ലാം മായ്ക്കണോ?")) {
      setRows(createRows(10));
      setCustomerName("");
      setTransportCost("");
      setDiscount("");
      setSaveStatus("New calculation");
    }
  }

  const calculatedRows = useMemo(() => {
    return rows.map((row) => {
      const days = getDays(row.from, row.to, row.sundayOff);
      const amount = Number(row.qty || 0) * Number(row.rent || 0) * days;
      return { ...row, days, amount };
    });
  }, [rows]);

  const activeRows = calculatedRows.filter(
    (row) => row.tool || row.qty || row.rent || row.from || row.to
  );

  const totalQty = calculatedRows.reduce(
    (sum, row) => sum + Number(row.qty || 0),
    0
  );

  const grandTotal = calculatedRows.reduce((sum, row) => sum + row.amount, 0);
  const transportAmount = Math.max(Number(transportCost || 0), 0);
  const discountAmount = Math.max(Number(discount || 0), 0);
  const finalTotal = Math.max(
    grandTotal + transportAmount - discountAmount,
    0
  );

  async function refreshDrafts() {
    const savedDrafts = await getAllSavedDrafts();
    setDrafts(savedDrafts);
  }

  function restoreDraft(draft: SavedDraft) {
    setCustomerName(draft.customerName || "");
    setTransportCost(draft.transportCost || "");
    setDiscount(draft.discount || "");
    setRows(draft.rows && draft.rows.length > 0 ? draft.rows : createRows(10));
    setShowDrafts(false);
    setSaveStatus("Draft opened");
  }

  async function deleteDraft(draft: SavedDraft) {
    if (!confirm(`${draft.customerName || "Draft"} delete ചെയ്യണോ?`)) return;
    await deleteDraftById(draft.id);
    await refreshDrafts();
    setSaveStatus("Draft deleted");
  }

  const filteredDrafts = drafts.filter((draft) =>
    draft.customerName.toLowerCase().includes(draftSearch.trim().toLowerCase())
  );

  useEffect(() => {
    async function loadInitialDrafts() {
      try {
        const currentDraft = await getDraft(CURRENT_DRAFT_ID);
        const savedDrafts = await getAllSavedDrafts();
        setDrafts(savedDrafts);

        if (
          currentDraft &&
          hasUsefulData(
            currentDraft.customerName,
            currentDraft.rows,
            currentDraft.transportCost || "",
            currentDraft.discount
          ) &&
          confirm("Previous calculation found. Continue?")
        ) {
          setCustomerName(currentDraft.customerName || "");
          setTransportCost(currentDraft.transportCost || "");
          setDiscount(currentDraft.discount || "");
          setRows(currentDraft.rows && currentDraft.rows.length > 0 ? currentDraft.rows : createRows(10));
          setSaveStatus("Previous calculation restored");
        }
      } catch (error) {
        console.error("Failed to load drafts", error);
      } finally {
        setLoadedFromDb(true);
      }
    }

    loadInitialDrafts();
  }, []);

  useEffect(() => {
    if (!loadedFromDb) return;

    const timer = window.setTimeout(async () => {
      try {
        const usefulData = hasUsefulData(
          customerName,
          rows,
          transportCost,
          discount
        );
        const now = Date.now();

        await putDraft({
          id: CURRENT_DRAFT_ID,
          customerName,
          transportCost,
          discount,
          rows,
          updatedAt: now,
        });

        if (customerName.trim() && usefulData) {
          await putDraft({
            id: makeDraftId(customerName),
            customerName: customerName.trim(),
            transportCost,
            discount,
            rows,
            updatedAt: now,
          });
          await refreshDrafts();
        }

        setSaveStatus("✓ Saved");
      } catch (error) {
        console.error("Failed to save draft", error);
        setSaveStatus("Save failed");
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [customerName, transportCost, discount, rows, loadedFromDb]);

  function buildShareText() {
    const lines = activeRows.map((row, index) => {
      return `${index + 1}. ${row.tool || "Tool"} | Qty: ${
        row.qty || 0
      } | Rent: ₹${row.rent || 0} | Days: ${row.days} | ₹${formatMoney(
        row.amount
      )}`;
    });

    const transportLine =
      transportAmount > 0
        ? `\nഗതാഗത ചെലവ്: ₹${formatMoney(transportAmount)}`
        : "";

    const discountLine =
      discountAmount > 0
        ? `\nഡിസ്‌കൗണ്ട്: ₹${formatMoney(discountAmount)}`
        : "";

    return `Tried & True Rental Calculator

ഉപഭോക്താവിന്റെ പേര്: ${customerName || "-"}

${lines.join("\n")}

ടൂൾസ് വാടക: ₹${formatMoney(grandTotal)}${transportLine}${discountLine}\nമൊത്തം അടക്കാനുള്ളത്: ₹${formatMoney(finalTotal)}`;
  }

  async function copyCalculation() {
    if (activeRows.length === 0) {
      alert("കോപ്പി ചെയ്യാൻ ഡാറ്റ ഇല്ല.");
      return;
    }

    await navigator.clipboard.writeText(buildShareText());
    alert("കോപ്പി ചെയ്തു. WhatsApp-ൽ paste ചെയ്യാം.");
  }

  async function shareText() {
    if (activeRows.length === 0) {
      alert("ഷെയർ ചെയ്യാൻ ഡാറ്റ ഇല്ല.");
      return;
    }

    const text = buildShareText();

    if (navigator.share) {
      await navigator.share({
        title: "Tried & True Rental Calculator",
        text,
      });
    } else {
      await navigator.clipboard.writeText(text);
      alert("Copied. WhatsApp-ൽ paste ചെയ്യാം.");
    }
  }

  async function shareJpg() {
    if (!customerName.trim()) {
      alert("ഫയൽ നാമത്തിനായി ഉപഭോക്താവിന്റെ പേര് നൽകുക.");
      return;
    }

    if (activeRows.length === 0) {
      alert("ഷെയർ ചെയ്യാൻ ഡാറ്റ ഇല്ല.");
      return;
    }

    if (!billRef.current) {
      alert("Bill not found.");
      return;
    }

    const originalBill = billRef.current;
    const billClone = originalBill.cloneNode(true) as HTMLDivElement;

    billClone.style.position = "fixed";
    billClone.style.left = "-10000px";
    billClone.style.top = "0";
    billClone.style.width = "1200px";
    billClone.style.minWidth = "1200px";
    billClone.style.maxWidth = "1200px";
    billClone.style.transform = "none";
    billClone.classList.add("forceDesktopBill");
    billClone.style.background = "#ffffff";
    billClone.style.zIndex = "999999";

    document.body.appendChild(billClone);

    try {
      const images = Array.from(billClone.querySelectorAll("img"));
      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();

          return new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          });
        })
      );

      const canvas = await html2canvas(billClone, {
        backgroundColor: "#ffffff",
        scale: 3,
        useCORS: true,
        width: billClone.scrollWidth,
        height: billClone.scrollHeight,
        windowWidth: 1200,
      });

      canvas.toBlob(
        async (blob) => {
          if (!blob) return;

          const fileName = billFileName(customerName);
          const file = new File([blob], fileName, {
            type: "image/jpeg",
          });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: fileName.replace(/\.jpg$/i, ""),
              text: "T&T Tools Rental Bill",
              files: [file],
            });
          } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
          }
        },
        "image/jpeg",
        0.95
      );
    } finally {
      document.body.removeChild(billClone);
    }
  }

  return (
    <AppShell
      title="Rental Calculator"
      subtitle="Calculate tool rent and prepare customer bills"
    >
      <main className="page">
      <div className="appLayout">
        <section className="leftPanel">
          <div className="customerBox">
            <label>ഉപഭോക്താവിന്റെ പേര്</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="ഉപഭോക്താവിന്റെ പേര്"
            />
            <div className="saveStatus">{saveStatus}</div>
          </div>

          <section className="sheetWrap">
            <div className="sheetScroll">
              <table className="rentTable">
                <thead>
                  <tr>
                    <th className="noCol">#</th>
                    <th className="rowActionsCol">ക്രമം</th>
                    <th className="toolCol">ഉപകരണം</th>
                    <th className="qtyCol">എണ്ണം</th>
                    <th className="rentCol">
                      ദിവസ
                      <br />
                      വാടക
                    </th>
                    <th className="sundayCol">
                      ഞായർ
                      <br />
                      ഒഴിവ്
                    </th>
                    <th className="dateCol">മുതൽ</th>
                    <th className="dateCol">വരെ</th>
                    <th className="dayCol">ദിവസം</th>
                    <th className="amountCol">തുക</th>
                  </tr>
                </thead>

                <tbody>
                  {calculatedRows.map((row, index) => (
                    <tr
                      key={index}
                      data-row-index={index}
                      className={[
                        draggingRowIndex === index ? "draggingRow" : "",
                        dragOverRowIndex === index ? "dragOverRow" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <td className="noCell">{index + 1}</td>

                      <td className="rowActionsCell">
                        <button
                          type="button"
                          className="dragHandle"
                          onPointerDown={(event) => startRowDrag(event, index)}
                          onPointerMove={continueRowDrag}
                          onPointerUp={finishRowDrag}
                          onPointerCancel={cancelRowDrag}
                          title="Press and drag to move this row"
                          aria-label={`Press and drag row ${index + 1} to move it`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M5 7h14M5 12h14M5 17h14" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          className="copyRowBtn"
                          onClick={() => copyRowBelow(index)}
                          title={`Copy row ${index + 1} below`}
                          aria-label={`Copy row ${index + 1} below`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="8" y="8" width="10" height="11" rx="1.5" />
                            <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
                            <path d="M11 11h4M13 9l2 2-2 2" />
                          </svg>
                        </button>
                      </td>

                      <td className="toolCell">
                        <input
                          value={row.tool}
                          onChange={(e) =>
                            updateRow(index, "tool", e.target.value)
                          }
                          placeholder="Tool name"
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          value={row.qty}
                          onChange={(e) =>
                            updateRow(index, "qty", e.target.value)
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          value={row.rent}
                          onChange={(e) =>
                            updateRow(index, "rent", e.target.value)
                          }
                        />
                      </td>

                      <td>
                        <button
                          type="button"
                          className={row.sundayOff ? "toggle active" : "toggle"}
                          onClick={() =>
                            updateRow(index, "sundayOff", !row.sundayOff)
                          }
                        >
                          <span>{row.sundayOff ? "ON" : "OFF"}</span>
                          <i />
                        </button>
                      </td>

                      <td>
                        <input
                          type="date"
                          value={row.from}
                          onChange={(e) =>
                            updateRow(index, "from", e.target.value)
                          }
                        />
                        <div className="dateShow">{formatDate(row.from)}</div>
                      </td>

                      <td>
                        <input
                          type="date"
                          value={row.to}
                          onChange={(e) =>
                            updateRow(index, "to", e.target.value)
                          }
                        />
                        <div className="dateShow">{formatDate(row.to)}</div>
                      </td>

                      <td className="daysCell">{row.days}</td>
                      <td className="amountCell">{formatMoney(row.amount)}</td>

                    </tr>
                  ))}

<tr className="totalRow">
  <td colSpan={3}>ടൂൾസ് വാടക</td>
  <td>{totalQty}</td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td>₹{formatMoney(grandTotal)}</td>
</tr>
                </tbody>
              </table>
            </div>
          </section>

          <div className="tableActions">
            <button className="addRowsBtn" onClick={addRows}>
              ➕ +5 വരികൾ ചേർക്കുക
            </button>

            <button className="clearRowsBtn" onClick={clearAll}>
              🗑️ മായ്ക്കുക
            </button>

            <button className="saveRowsBtn" onClick={copyCalculation}>
              📋 കോപ്പി
            </button>
          </div>
        </section>

        <aside className="rightPanel">
          <div className="brandBlock">
            <h1>Tried &amp; True</h1>
            <h2>Rental Calculator</h2>
          </div>

          <div className="costInputStack">
            <div className="discountBox transportBox">
              <label>🚚 ഗതാഗത ചെലവ്</label>
              <input
                type="number"
                min="0"
                value={transportCost}
                onChange={(e) => setTransportCost(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="discountBox">
              <label>🎁 ഡിസ്‌കൗണ്ട്</label>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {transportAmount > 0 && (
            <div className="discountLine transportLine">
              <span>🚚 ഗതാഗത ചെലവ്</span>
              <strong>₹{formatMoney(transportAmount)}</strong>
            </div>
          )}

          {discountAmount > 0 && (
            <div className="discountLine">
              <span>🎁 ഡിസ്‌കൗണ്ട്</span>
              <strong>− ₹{formatMoney(discountAmount)}</strong>
            </div>
          )}

          <div className="grandCard">
            <span>🧾 മൊത്തം അടക്കാനുള്ളത്</span>
            <strong>₹{formatMoney(finalTotal)}</strong>
          </div>

          <button className="draftBtn" onClick={() => setShowDrafts(true)}>
            📂 Saved Drafts
          </button>

          <div className="shareTitle">📤 ഷെയർ ചെയ്യുക</div>

          <button className="jpgBtn" onClick={shareJpg}>
            🖼️ JPG ആയി ഷെയർ ചെയ്യുക
          </button>

          <button className="waBtn" onClick={shareText}>
            💬 WhatsApp-ൽ ഷെയർ ചെയ്യുക
          </button>

          <button className="resetBtn" onClick={clearAll}>
            🔄 വീണ്ടും തുടങ്ങുക
          </button>

          <div className="panelFooter">
            © 2026 Tried &amp; True Tools Rentals
            <br />
            All rights reserved.
            <br />
            Made with ❤️ in India
          </div>
        </aside>
      </div>

      {showDrafts && (
        <div className="draftOverlay">
          <div className="draftModal">
            <div className="draftModalHead">
              <h3>📂 Saved Drafts</h3>
              <button onClick={() => setShowDrafts(false)}>×</button>
            </div>

            <input
              className="draftSearch"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              placeholder="Customer name search ചെയ്യുക"
            />

            <div className="draftList">
              {filteredDrafts.length === 0 ? (
                <div className="emptyDraft">Saved drafts ഇല്ല.</div>
              ) : (
                filteredDrafts.map((draft) => {
                  const itemCount = draft.rows.filter(
                    (row) => row.tool || row.qty || row.rent || row.from || row.to
                  ).length;

                  return (
                    <div className="draftItem" key={draft.id}>
                      <button className="draftOpen" onClick={() => restoreDraft(draft)}>
                        <strong>{draft.customerName}</strong>
                        <span>
                          {new Date(draft.updatedAt).toLocaleDateString("en-IN")} • {itemCount} items
                        </span>
                      </button>

                      <button className="draftDelete" onClick={() => deleteDraft(draft)}>
                        🗑️
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <div className="billCapture" id="professional-bill" ref={billRef}>
        <div className="billHeader">
          <img src="/tt-logo-horizontal.png?v=20260717" alt="Tried & True" className="billLogo" />
        </div>

        <div className="billDate">
          <strong>Date :</strong>
          <span>{todayText()}</span>
        </div>

        <div className="branchGrid">
          {branches.map((b) => (
            <div className="branchCard" key={b.name}>
              <strong>📍 {b.name}</strong>
              <span>{b.address}</span>
              <b>Mob: {b.mob}</b>
            </div>
          ))}
        </div>

        <div className="billCustomer">
          <strong>ഉപഭോക്താവിന്റെ പേര്</strong>
          <span>:</span>
          <b>{customerName || "-"}</b>
        </div>

        <table className="billTable">
          <thead>
            <tr>
              <th>#</th>
              <th>ഉപകരണം</th>
              <th>എണ്ണം</th>
              <th>ദിവസ വാടക</th>
              <th>മുതൽ</th>
              <th>വരെ</th>
              <th>ദിവസം</th>
              <th>തുക</th>
            </tr>
          </thead>

          <tbody>
            {activeRows.map((row, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{row.tool || "-"}</td>
                <td>{row.qty || "-"}</td>
                <td>₹ {row.rent || "-"}</td>
                <td>
                  {row.from || "-"}
                  <br />
                  <small>{formatDate(row.from)}</small>
                </td>
                <td>
                  {row.to || "-"}
                  <br />
                  <small>{formatDate(row.to)}</small>
                </td>
                <td>{row.days}</td>
                <td>₹ {formatMoney(row.amount)}</td>
              </tr>
            ))}

            <tr className="billTotalRow">
              <td colSpan={7} style={{ textAlign: "center", fontWeight: 900 }}>
                ടൂൾസ് വാടക
              </td>
              <td style={{ fontWeight: 900 }}>₹ {formatMoney(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        <div className="billBottom">
          <div className="billBottomSpacer" aria-hidden="true" />

          <div className="billTotals">
            <div className="billTotalLine">
              <span className="billTotalLabel">ടൂൾസ് വാടക</span>
              <span className="billTotalColon">:</span>
              <b>₹ {formatMoney(grandTotal)}</b>
            </div>

            {transportAmount > 0 && (
              <div className="billTotalLine">
                <span className="billTotalLabel">ഗതാഗത ചെലവ്</span>
                <span className="billTotalColon">:</span>
                <b>₹ {formatMoney(transportAmount)}</b>
              </div>
            )}

            {discountAmount > 0 && (
              <div className="billTotalLine">
                <span className="billTotalLabel">ഡിസ്‌കൗണ്ട്</span>
                <span className="billTotalColon">:</span>
                <b>− ₹ {formatMoney(discountAmount)}</b>
              </div>
            )}

            <div className="billTotalLine billPayableLine">
              <span className="billTotalLabel">മൊത്തം അടക്കാനുള്ളത്</span>
              <span className="billTotalColon">:</span>
              <b>₹ {formatMoney(finalTotal)}</b>
            </div>
          </div>

          <div className="paymentCard">
            <div className="paymentHead">
              <span>GPay :</span>
              <strong>9544011404</strong>
            </div>
            <img
              src={qrSrc}
              alt="GPay QR Code"
              className="paymentQr"
              crossOrigin="anonymous"
              onError={() => {
                if (qrSrc !== "/gpay-qr.png") {
                  setQrSrc("/gpay-qr.png");
                }
              }}
            />
          </div>
        </div>

        <div className="billCreated">
          <div className="billTagline">
            ഗുണമേന്മയുള്ള ഉപകരണങ്ങൾ • ന്യായമായ വാടക • വിശ്വസനീയമായ സേവനം.
          </div>
          <div className="billCreatedText">
            ഈ ബിൽ <b>T&amp;T Tools Rental Calculator</b> ഉപയോഗിച്ച് തയ്യാറാക്കിയതാണ്.
          </div>
          <div className="billCopyright">
            © 2026 Tried &amp; True Tools Rentals. All rights reserved.
          </div>
        </div>
      </div>
      </main>
    </AppShell>
  );
  
}

