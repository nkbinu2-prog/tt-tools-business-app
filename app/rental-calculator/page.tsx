"use client";

import html2canvas from "html2canvas";
import AppShell from "../../components/AppShell";
import { type ChangeEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type Row = {
  tool: string;
  qty: string;
  rent: string;
  sundayOff: boolean;
  from: string;
  to: string;
};

type PaymentRow = {
  date: string;
  amount: string;
  note: string;
};

type TransportRow = {
  date: string;
  place: string;
  amount: string;
};

type HolidayRow = {
  date: string;
  name: string;
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

const emptyPaymentRow = (): PaymentRow => ({
  date: "",
  amount: "",
  note: "",
});

const createPaymentRows = (count: number) =>
  Array.from({ length: count }, () => emptyPaymentRow());

const emptyTransportRow = (): TransportRow => ({
  date: "",
  place: "",
  amount: "",
});

const createTransportRows = (count: number) =>
  Array.from({ length: count }, () => emptyTransportRow());

const emptyHolidayRow = (): HolidayRow => ({
  date: "",
  name: "",
});

const createHolidayRows = (count: number) =>
  Array.from({ length: count }, () => emptyHolidayRow());

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

function getDays(
  from: string,
  to: string,
  sundayOff: boolean,
  holidays: HolidayRow[]
) {
  if (!from || !to) return 0;

  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");

  if (end < start) return 0;

  const totalDays =
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const holidayDates = new Set(
    holidays
      .map((holiday) => holiday.date)
      .filter((date) => {
        if (!date) return false;
        const holidayDate = new Date(date + "T00:00:00");
        return (
          holidayDate >= start &&
          holidayDate <= end &&
          !(sundayOff && holidayDate.getDay() === 0)
        );
      })
  );

  const excludedSundays = sundayOff ? countSundays(start, end) : 0;
  return Math.max(totalDays - excludedSundays - holidayDates.size, 0);
}

function formatMoney(value: number) {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}


function calculationFileName(customerName: string) {
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

  return `${date} - ${safeCustomerName || "Calculation"}.ttcalc`;
}

function normalizeCalculationData(value: unknown): CalculationData | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.rows)) return null;

  const rows: Row[] = record.rows.map((item) => {
    const row = item && typeof item === "object"
      ? (item as Record<string, unknown>)
      : {};

    return {
      tool: String(row.tool ?? ""),
      qty: String(row.qty ?? ""),
      rent: String(row.rent ?? ""),
      sundayOff: row.sundayOff !== false,
      from: String(row.from ?? ""),
      to: String(row.to ?? ""),
    };
  });

  const payments: PaymentRow[] = Array.isArray(record.payments)
    ? record.payments.map((item) => {
        const payment = item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : {};

        return {
          date: String(payment.date ?? ""),
          amount: String(payment.amount ?? ""),
          note: String(payment.note ?? ""),
        };
      })
    : createPaymentRows(1);

  const transports: TransportRow[] = Array.isArray(record.transports)
    ? record.transports.map((item) => {
        const transport = item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : {};

        return {
          date: String(transport.date ?? ""),
          place: String(transport.place ?? ""),
          amount: String(transport.amount ?? ""),
        };
      })
    : Number(record.transportCost || 0) > 0
      ? [{ date: "", place: "", amount: String(record.transportCost) }]
      : createTransportRows(1);

  const holidays: HolidayRow[] = Array.isArray(record.holidays)
    ? record.holidays.map((item) => {
        const holiday = item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : {};

        return {
          date: String(holiday.date ?? ""),
          name: String(holiday.name ?? ""),
        };
      })
    : createHolidayRows(1);

  return {
    customerName: String(record.customerName ?? ""),
    openingBalance: String(record.openingBalance ?? ""),
    transports: transports.length > 0 ? transports : createTransportRows(1),
    discount: String(record.discount ?? ""),
    advance: String(record.advance ?? ""),
    payments: payments.length > 0 ? payments : createPaymentRows(1),
    holidays: holidays.length > 0 ? holidays : createHolidayRows(1),
    rows: rows.length > 0 ? rows : createRows(10),
  };
}



type CalculationData = {
  customerName: string;
  openingBalance: string;
  transports: TransportRow[];
  discount: string;
  advance: string;
  payments: PaymentRow[];
  holidays: HolidayRow[];
  rows: Row[];
};

type CalculationFile = {
  format: "tt-tools-rental-calculation";
  version: 1;
  savedAt: string;
  data: CalculationData;
};

type SavedDraft = {
  id: string;
  customerName: string;
  openingBalance?: string;
  transportCost?: string;
  transports?: TransportRow[];
  discount: string;
  advance?: string;
  payments?: PaymentRow[];
  holidays?: HolidayRow[];
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
  openingBalance: string,
  transports: TransportRow[],
  discount: string,
  advance: string,
  payments: PaymentRow[],
  holidays: HolidayRow[]
) {
  return Boolean(
    customerName.trim() ||
      openingBalance.trim() ||
      transports.some((transport) => transport.date || transport.place || transport.amount) ||
      discount.trim() ||
      advance.trim() ||
      payments.some((payment) => payment.date || payment.amount || payment.note) ||
      holidays.some((holiday) => holiday.date || holiday.name) ||
      rows.some((row) => row.tool || row.qty || row.rent || row.from || row.to)
  );
}

export default function Home() {
  const [customerName, setCustomerName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [transports, setTransports] = useState<TransportRow[]>(createTransportRows(1));
  const [discount, setDiscount] = useState("");
  const [advance, setAdvance] = useState("");
  const [payments, setPayments] = useState<PaymentRow[]>(createPaymentRows(1));
  const [holidays, setHolidays] = useState<HolidayRow[]>(createHolidayRows(1));
  const [rows, setRows] = useState<Row[]>(createRows(10));
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [draftSearch, setDraftSearch] = useState("");
  const [showDrafts, setShowDrafts] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Ready");
  const [loadedFromDb, setLoadedFromDb] = useState(false);
  const [lastFileSavedSnapshot, setLastFileSavedSnapshot] = useState("");
  const [fileSaveStatus, setFileSaveStatus] = useState("Bill file not saved");
  const [qrSrc, setQrSrc] = useState("/gpay-qr.png");
  const [draggingRowIndex, setDraggingRowIndex] = useState<number | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);

  const billRef = useRef<HTMLDivElement | null>(null);
  const calculationFileInputRef = useRef<HTMLInputElement | null>(null);
  const dragSourceIndexRef = useRef<number | null>(null);
  const dragTargetIndexRef = useRef<number | null>(null);



  const calculationData = useMemo<CalculationData>(
    () => ({
      customerName,
      openingBalance,
      transports,
      discount,
      advance,
      payments,
      holidays,
      rows,
    }),
    [
      customerName,
      openingBalance,
      transports,
      discount,
      advance,
      payments,
      holidays,
      rows,
    ]
  );

  const calculationSnapshot = useMemo(
    () => JSON.stringify(calculationData),
    [calculationData]
  );

  const hasCurrentCalculationData = hasUsefulData(
    customerName,
    rows,
    openingBalance,
    transports,
    discount,
    advance,
    payments,
    holidays
  );

  const hasUnsavedFileChanges =
    hasCurrentCalculationData && calculationSnapshot !== lastFileSavedSnapshot;

  function updateRow(index: number, field: keyof Row, value: string | boolean) {
    const copy = [...rows];
    copy[index] = { ...copy[index], [field]: value };
    setRows(copy);
  }

  function addRows() {
    setRows([...rows, ...createRows(5)]);
  }

  function addPaymentRow() {
    setPayments((current) => [...current, emptyPaymentRow()]);
  }

  function addTransportRow() {
    setTransports((current) => [...current, emptyTransportRow()]);
  }

  function addHolidayRow() {
    setHolidays((current) => [...current, emptyHolidayRow()]);
  }

  function updateHolidayRow(index: number, field: keyof HolidayRow, value: string) {
    setHolidays((current) =>
      current.map((holiday, holidayIndex) =>
        holidayIndex === index ? { ...holiday, [field]: value } : holiday
      )
    );
  }

  function removeHolidayRow(index: number) {
    setHolidays((current) => {
      const updated = current.filter((_, holidayIndex) => holidayIndex !== index);
      return updated.length > 0 ? updated : createHolidayRows(1);
    });
  }

  function updateTransportRow(
    index: number,
    field: keyof TransportRow,
    value: string
  ) {
    setTransports((current) =>
      current.map((transport, transportIndex) =>
        transportIndex === index ? { ...transport, [field]: value } : transport
      )
    );
  }

  function removeTransportRow(index: number) {
    setTransports((current) => {
      const updated = current.filter((_, transportIndex) => transportIndex !== index);
      return updated.length > 0 ? updated : createTransportRows(1);
    });
  }

  function updatePaymentRow(
    index: number,
    field: keyof PaymentRow,
    value: string
  ) {
    setPayments((current) =>
      current.map((payment, paymentIndex) =>
        paymentIndex === index ? { ...payment, [field]: value } : payment
      )
    );
  }

  function removePaymentRow(index: number) {
    setPayments((current) => {
      const updated = current.filter((_, paymentIndex) => paymentIndex !== index);
      return updated.length > 0 ? updated : createPaymentRows(1);
    });
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



  async function downloadCalculationFile() {
    if (!hasCurrentCalculationData) {
      alert("Save ചെയ്യാൻ calculation details ഇല്ല.");
      return false;
    }

    const payload: CalculationFile = {
      format: "tt-tools-rental-calculation",
      version: 1,
      savedAt: new Date().toISOString(),
      data: calculationData,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });

    const fileName = calculationFileName(customerName);
    const savePickerWindow = window as typeof window & {
      showSaveFilePicker?: (options: {
        suggestedName: string;
        types: Array<{
          description: string;
          accept: Record<string, string[]>;
        }>;
      }) => Promise<{
        createWritable: () => Promise<{
          write: (data: Blob) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    };

    try {
      if (savePickerWindow.showSaveFilePicker) {
        const fileHandle = await savePickerWindow.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: "T&T Rental Calculator File",
              accept: { "application/json": [".ttcalc"] },
            },
          ],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const file = new File([blob], fileName, {
          type: "application/json;charset=utf-8",
        });

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: fileName.replace(/\.ttcalc$/i, ""),
            files: [file],
          });
        } else {
          downloadBlob(blob, fileName);
        }
      }

      setLastFileSavedSnapshot(calculationSnapshot);
      setFileSaveStatus(`✓ Saved: ${fileName}`);
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return false;
      }

      console.error("Failed to save bill file", error);
      alert("Bill file save ചെയ്യാൻ കഴിഞ്ഞില്ല.");
      return false;
    }
  }

  async function confirmSaveBeforeContinuing(actionText: string) {
    if (!hasUnsavedFileChanges) return true;

    const saveFirst = confirm(
      `Current calculation is not saved as a file. Save it before ${actionText}?`
    );

    if (saveFirst) return await downloadCalculationFile();

    return confirm(`Continue ${actionText} without saving the bill file?`);
  }

  async function requestOpenCalculationFile() {
    if (!(await confirmSaveBeforeContinuing("opening another bill"))) return;
    calculationFileInputRef.current?.click();
  }

  async function openCalculationFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const root = parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
      const candidate = root && "data" in root ? root.data : parsed;
      const data = normalizeCalculationData(candidate);

      if (!data) throw new Error("Invalid calculation file");

      setCustomerName(data.customerName);
      setOpeningBalance(data.openingBalance);
      setTransports(data.transports);
      setDiscount(data.discount);
      setAdvance(data.advance);
      setPayments(data.payments);
      setHolidays(data.holidays);
      setRows(data.rows);
      setLastFileSavedSnapshot(JSON.stringify(data));
      setFileSaveStatus(`✓ Opened: ${file.name}`);
      setSaveStatus("Bill file opened");
      setShowDrafts(false);
    } catch (error) {
      console.error("Failed to open bill file", error);
      alert("This is not a valid T&T Rental bill file.");
    }
  }


  async function clearAll() {
    if (!confirm("എല്ലാം മായ്ക്കണോ?")) return;
    if (!(await confirmSaveBeforeContinuing("starting a new calculation"))) return;

    {
      setRows(createRows(10));
      setCustomerName("");
      setOpeningBalance("");
      setTransports(createTransportRows(1));
      setDiscount("");
      setAdvance("");
      setPayments(createPaymentRows(1));
      setHolidays(createHolidayRows(1));
      setLastFileSavedSnapshot("");
      setFileSaveStatus("Bill file not saved");
      setSaveStatus("New calculation");
    }
  }

  const calculatedRows = useMemo(() => {
    return rows.map((row) => {
      const days = getDays(row.from, row.to, row.sundayOff, holidays);
      const amount = Number(row.qty || 0) * Number(row.rent || 0) * days;
      return { ...row, days, amount };
    });
  }, [rows, holidays]);

  const activeRows = calculatedRows
    .filter((row) => row.tool || row.qty || row.rent || row.from || row.to)
    .map((row, index) => ({ ...row, originalIndex: index }))
    .sort((a, b) => {
      if (!a.from && !b.from) return a.originalIndex - b.originalIndex;
      if (!a.from) return 1;
      if (!b.from) return -1;
      return a.from.localeCompare(b.from) || a.originalIndex - b.originalIndex;
    });

  const activeHolidays = holidays
    .map((holiday, index) => ({ ...holiday, originalIndex: index }))
    .filter((holiday) => holiday.date)
    .sort((a, b) =>
      a.date.localeCompare(b.date) || a.originalIndex - b.originalIndex
    );

  const totalQty = calculatedRows.reduce(
    (sum, row) => sum + Number(row.qty || 0),
    0
  );

  const grandTotal = calculatedRows.reduce((sum, row) => sum + row.amount, 0);
  const openingBalanceAmount = Math.max(Number(openingBalance || 0), 0);
  const rentWithOpeningBalance = openingBalanceAmount + grandTotal;
  const activeTransports = transports
    .map((transport, index) => ({ ...transport, originalIndex: index }))
    .filter(
      (transport) =>
        transport.date || transport.place || Number(transport.amount || 0) > 0
    )
    .sort((a, b) => {
      if (!a.date && !b.date) return a.originalIndex - b.originalIndex;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date) || a.originalIndex - b.originalIndex;
    });
  const transportAmount = transports.reduce(
    (sum, transport) => sum + Math.max(Number(transport.amount || 0), 0),
    0
  );
  const discountAmount = Math.max(Number(discount || 0), 0);
  const advanceAmount = Math.max(Number(advance || 0), 0);
  const activePayments = payments
    .map((payment, index) => ({ ...payment, originalIndex: index }))
    .filter(
      (payment) => payment.date || Number(payment.amount || 0) > 0 || payment.note
    )
    .sort((a, b) => {
      if (!a.date && !b.date) return a.originalIndex - b.originalIndex;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date) || a.originalIndex - b.originalIndex;
    });
  const totalPayments = payments.reduce(
    (sum, payment) => sum + Math.max(Number(payment.amount || 0), 0),
    0
  );
  const finalTotal = Math.max(
    openingBalanceAmount +
      grandTotal +
      transportAmount -
      discountAmount -
      advanceAmount -
      totalPayments,
    0
  );

  let runningBillBalance = openingBalanceAmount - advanceAmount;
  const rentalBalances = activeRows.map((row) => {
    runningBillBalance += row.amount;
    return runningBillBalance;
  });
  const transportBalances = activeTransports.map((transport) => {
    runningBillBalance += Math.max(Number(transport.amount || 0), 0);
    return runningBillBalance;
  });
  const paymentBalances = activePayments.map((payment) => {
    runningBillBalance -= Math.max(Number(payment.amount || 0), 0);
    return runningBillBalance;
  });

  async function refreshDrafts() {
    const savedDrafts = await getAllSavedDrafts();
    setDrafts(savedDrafts);
  }

  async function restoreDraft(draft: SavedDraft) {
    if (!(await confirmSaveBeforeContinuing("opening the saved draft"))) return;

    setCustomerName(draft.customerName || "");
    setOpeningBalance(draft.openingBalance || "");
    setTransports(
      draft.transports && draft.transports.length > 0
        ? draft.transports
        : Number(draft.transportCost || 0) > 0
          ? [{ date: "", place: "", amount: String(draft.transportCost) }]
          : createTransportRows(1)
    );
    setDiscount(draft.discount || "");
    setAdvance(draft.advance || "");
    setPayments(
      draft.payments && draft.payments.length > 0
        ? draft.payments
        : createPaymentRows(1)
    );
    setHolidays(
      draft.holidays && draft.holidays.length > 0
        ? draft.holidays
        : createHolidayRows(1)
    );
    setRows(draft.rows && draft.rows.length > 0 ? draft.rows : createRows(10));
    setLastFileSavedSnapshot("");
    setFileSaveStatus("Draft opened — save as file");
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
            currentDraft.openingBalance || "",
            currentDraft.transports && currentDraft.transports.length > 0
              ? currentDraft.transports
              : Number(currentDraft.transportCost || 0) > 0
                ? [{ date: "", place: "", amount: String(currentDraft.transportCost) }]
                : createTransportRows(1),
            currentDraft.discount,
            currentDraft.advance || "",
            currentDraft.payments || [],
            currentDraft.holidays || []
          ) &&
          confirm("Previous calculation found. Continue?")
        ) {
          setCustomerName(currentDraft.customerName || "");
          setOpeningBalance(currentDraft.openingBalance || "");
          setTransports(
            currentDraft.transports && currentDraft.transports.length > 0
              ? currentDraft.transports
              : Number(currentDraft.transportCost || 0) > 0
                ? [{ date: "", place: "", amount: String(currentDraft.transportCost) }]
                : createTransportRows(1)
          );
          setDiscount(currentDraft.discount || "");
          setAdvance(currentDraft.advance || "");
          setPayments(
            currentDraft.payments && currentDraft.payments.length > 0
              ? currentDraft.payments
              : createPaymentRows(1)
          );
          setHolidays(
            currentDraft.holidays && currentDraft.holidays.length > 0
              ? currentDraft.holidays
              : createHolidayRows(1)
          );
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
          openingBalance,
          transports,
          discount,
          advance,
          payments,
          holidays
        );
        const now = Date.now();

        await putDraft({
          id: CURRENT_DRAFT_ID,
          customerName,
          openingBalance,
          transports,
          discount,
          advance,
          payments,
          holidays,
          rows,
          updatedAt: now,
        });

        if (customerName.trim() && usefulData) {
          await putDraft({
            id: makeDraftId(customerName),
            customerName: customerName.trim(),
            openingBalance,
            transports,
            discount,
            advance,
            payments,
            holidays,
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
  }, [
    customerName,
    openingBalance,
    transports,
    discount,
    advance,
    payments,
    holidays,
    rows,
    loadedFromDb,
  ]);


  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedFileChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedFileChanges]);

  function buildShareText() {
    const lines = activeRows.map((row, index) => {
      return `${index + 1}. ${row.tool || "Tool"} | Qty: ${
        row.qty || 0
      } | Rent: ₹${row.rent || 0} | Days: ${row.days} | ₹${formatMoney(
        row.amount
      )}`;
    });

    const openingBalanceLine =
      openingBalanceAmount > 0
        ? `മുൻ ബാലൻസ്: ₹${formatMoney(openingBalanceAmount)}\n`
        : "";

    const transportLines = activeTransports
      .map((transport) => {
        const amount = Math.max(Number(transport.amount || 0), 0);
        if (amount <= 0) return "";

        const dateLabel = transport.date
          ? new Date(transport.date + "T00:00:00").toLocaleDateString("en-IN")
          : "-";
        const placeLabel = transport.place.trim()
          ? ` - ${transport.place.trim()}`
          : "";

        return `\nഗതാഗത ചെലവ് (${dateLabel})${placeLabel}: ₹${formatMoney(amount)}`;
      })
      .filter(Boolean)
      .join("");

    const discountLine =
      discountAmount > 0
        ? `\nഡിസ്‌കൗണ്ട്: ₹${formatMoney(discountAmount)}`
        : "";

    const advanceLine =
      advanceAmount > 0
        ? `\nഅഡ്വാൻസ്: ₹${formatMoney(advanceAmount)}`
        : "";

    const paymentLines = activePayments
      .map((payment) => {
        const amount = Math.max(Number(payment.amount || 0), 0);
        if (amount <= 0) return "";

        const dateLabel = payment.date
          ? new Date(payment.date + "T00:00:00").toLocaleDateString("en-IN")
          : "-";
        const noteLabel = payment.note.trim() ? ` - ${payment.note.trim()}` : "";

        return `\nവരവ് (${dateLabel})${noteLabel}: ₹${formatMoney(amount)}`;
      })
      .filter(Boolean)
      .join("");

    const holidayLines = activeHolidays.length > 0
      ? `\n\nഅവധി ദിവസങ്ങളായതിനാൽ താഴെപ്പറയുന്ന ദിവസങ്ങൾക്ക് വാടക ഈടാക്കിയിട്ടില്ല:\n${activeHolidays
          .map(
            (holiday) =>
              `• ${new Date(holiday.date + "T00:00:00").toLocaleDateString("en-IN")} - ${holiday.name.trim() || "അവധി"}`
          )
          .join("\n")}`
      : "";

    return `Tried & True Rental Calculator

ഉപഭോക്താവിന്റെ പേര്: ${customerName || "-"}

${openingBalanceLine}${lines.join("\n")}${holidayLines}

ടൂൾസ് വാടക: ₹${formatMoney(
      grandTotal
    )}${discountLine}${advanceLine}${paymentLines}${transportLines}\nമൊത്തം അടക്കാനുള്ളത്: ₹${formatMoney(finalTotal)}`;
  }

  async function copyCalculation() {
    if (
      activeRows.length === 0 &&
      openingBalanceAmount === 0 &&
      advanceAmount === 0 &&
      totalPayments === 0
    ) {
      alert("കോപ്പി ചെയ്യാൻ ഡാറ്റ ഇല്ല.");
      return;
    }

    await navigator.clipboard.writeText(buildShareText());
    alert("കോപ്പി ചെയ്തു. WhatsApp-ൽ paste ചെയ്യാം.");
  }

  async function shareText() {
    if (
      activeRows.length === 0 &&
      openingBalanceAmount === 0 &&
      advanceAmount === 0 &&
      totalPayments === 0
    ) {
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
    if (!(await confirmSaveBeforeContinuing("sharing the JPG"))) return;

    if (!customerName.trim()) {
      alert("ഫയൽ നാമത്തിനായി ഉപഭോക്താവിന്റെ പേര് നൽകുക.");
      return;
    }

    if (
      activeRows.length === 0 &&
      openingBalanceAmount === 0 &&
      advanceAmount === 0 &&
      totalPayments === 0
    ) {
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

  async function downloadJpg() {
    if (!(await confirmSaveBeforeContinuing("downloading the JPG"))) return;

    if (!customerName.trim()) {
      alert("ഫയൽ നാമത്തിനായി ഉപഭോക്താവിന്റെ പേര് നൽകുക.");
      return;
    }

    if (
      activeRows.length === 0 &&
      openingBalanceAmount === 0 &&
      advanceAmount === 0 &&
      totalPayments === 0
    ) {
      alert("ഡൗൺലോഡ് ചെയ്യാൻ ഡാറ്റ ഇല്ല.");
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
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");

          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();

          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  <td colSpan={3}>
    {openingBalanceAmount > 0 ? "മുൻ ബാലൻസ് + ടൂൾസ് വാടക" : "ടൂൾസ് വാടക"}
  </td>
  <td>{totalQty}</td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td>₹{formatMoney(rentWithOpeningBalance)}</td>
</tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="holidayEntryBox">
            <div className="holidayEntryTitle">🎉 വാടക ഈടാക്കാത്ത അവധി ദിവസങ്ങൾ</div>
            <div className="holidayEntryHead">
              <span>തീയതി</span>
              <span>അവധിയുടെ പേര്</span>
              <span></span>
            </div>
            {holidays.map((holiday, index) => (
              <div className="holidayEntryRow" key={index}>
                <input
                  type="date"
                  value={holiday.date}
                  onChange={(event) =>
                    updateHolidayRow(index, "date", event.target.value)
                  }
                  aria-label="Holiday date"
                />
                <input
                  type="text"
                  value={holiday.name}
                  onChange={(event) =>
                    updateHolidayRow(index, "name", event.target.value)
                  }
                  placeholder="ഉദാ: ഓണം / വിഷു"
                  aria-label="Holiday name"
                />
                <button
                  type="button"
                  onClick={() => removeHolidayRow(index)}
                  title="Remove holiday"
                  aria-label="Remove holiday"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="addHolidayBtn"
              onClick={addHolidayRow}
            >
              ➕ മറ്റൊരു അവധി ദിവസം ചേർക്കുക
            </button>
          </section>

          <section
            style={{
              marginTop: 10,
              background: "#ffffff",
              border: "1px solid #d9e2ef",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(150px, 0.8fr) minmax(130px, 0.7fr) minmax(180px, 1.5fr) 70px",
                background: "#0057ff",
                color: "#ffffff",
                fontWeight: 900,
                textAlign: "center",
              }}
            >
              <div style={{ padding: "10px 8px" }}>തീയതി</div>
              <div style={{ padding: "10px 8px" }}>വരവ്</div>
              <div style={{ padding: "10px 8px" }}>കുറിപ്പ്</div>
              <div style={{ padding: "10px 8px" }}></div>
            </div>

            {payments.map((payment, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(150px, 0.8fr) minmax(130px, 0.7fr) minmax(180px, 1.5fr) 70px",
                  gap: 8,
                  alignItems: "center",
                  padding: 8,
                  borderTop: index === 0 ? "0" : "1px solid #e1e7ef",
                }}
              >
                <input
                  type="date"
                  value={payment.date}
                  onChange={(event) =>
                    updatePaymentRow(index, "date", event.target.value)
                  }
                  style={{
                    width: "100%",
                    height: 38,
                    border: "1px solid #cbd5e1",
                    borderRadius: 7,
                    padding: "0 8px",
                    fontWeight: 700,
                  }}
                />
                <input
                  type="number"
                  min="0"
                  value={payment.amount}
                  onChange={(event) =>
                    updatePaymentRow(index, "amount", event.target.value)
                  }
                  placeholder="0"
                  style={{
                    width: "100%",
                    height: 38,
                    border: "1px solid #cbd5e1",
                    borderRadius: 7,
                    padding: "0 8px",
                    textAlign: "center",
                    fontWeight: 900,
                  }}
                />
                <input
                  type="text"
                  value={payment.note}
                  onChange={(event) =>
                    updatePaymentRow(index, "note", event.target.value)
                  }
                  placeholder="Cash / GPay / Other"
                  style={{
                    width: "100%",
                    height: 38,
                    border: "1px solid #cbd5e1",
                    borderRadius: 7,
                    padding: "0 10px",
                    fontWeight: 700,
                  }}
                />
                <button
                  type="button"
                  onClick={() => removePaymentRow(index)}
                  title="Remove വരവ്"
                  style={{
                    height: 38,
                    border: 0,
                    borderRadius: 7,
                    background: "#ef2d2d",
                    color: "#ffffff",
                    fontSize: 18,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addPaymentRow}
              style={{
                width: "100%",
                minHeight: 42,
                border: 0,
                borderTop: "1px solid #d9e2ef",
                background: "#eaf2ff",
                color: "#0057ff",
                fontSize: 15,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              ➕ വരവ് ചേർക്കുക
            </button>
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
            <div className="discountBox">
              <label>മുൻ ബാലൻസ്</label>
              <input
                type="number"
                min="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
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

            <div className="discountBox">
              <label>അഡ്വാൻസ്</label>
              <input
                type="number"
                min="0"
                value={advance}
                onChange={(e) => setAdvance(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {openingBalanceAmount > 0 && (
            <div className="discountLine">
              <span>മുൻ ബാലൻസ്</span>
              <strong>₹{formatMoney(openingBalanceAmount)}</strong>
            </div>
          )}

          {discountAmount > 0 && (
            <div className="discountLine">
              <span>🎁 ഡിസ്‌കൗണ്ട്</span>
              <strong>− ₹{formatMoney(discountAmount)}</strong>
            </div>
          )}

          {advanceAmount > 0 && (
            <div className="discountLine">
              <span>അഡ്വാൻസ്</span>
              <strong>− ₹{formatMoney(advanceAmount)}</strong>
            </div>
          )}

          <section className="transportEntryBox">
            <div className="transportEntryTitle">🚚 ഗതാഗത ചെലവ്</div>
            {transports.map((transport, index) => (
              <div className="transportEntryRow" key={index}>
                <input
                  type="date"
                  value={transport.date}
                  onChange={(event) =>
                    updateTransportRow(index, "date", event.target.value)
                  }
                  aria-label="Transport date"
                />
                <input
                  type="text"
                  value={transport.place}
                  onChange={(event) =>
                    updateTransportRow(index, "place", event.target.value)
                  }
                  placeholder="സ്ഥലം"
                  aria-label="Transport place"
                />
                <input
                  type="number"
                  min="0"
                  value={transport.amount}
                  onChange={(event) =>
                    updateTransportRow(index, "amount", event.target.value)
                  }
                  placeholder="തുക"
                  aria-label="Transport amount"
                />
                <button
                  type="button"
                  onClick={() => removeTransportRow(index)}
                  title="Remove transport"
                  aria-label="Remove transport"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="addTransportBtn"
              onClick={addTransportRow}
            >
              ➕ ഗതാഗതം ചേർക്കുക
            </button>
            {transportAmount > 0 && (
              <div className="transportEntryTotal">
                <span>ഗതാഗതം ആകെ</span>
                <strong>₹{formatMoney(transportAmount)}</strong>
              </div>
            )}
          </section>

          <div className="grandCard">
            <span>🧾 മൊത്തം അടക്കാനുള്ളത്</span>
            <strong>₹{formatMoney(finalTotal)}</strong>
          </div>


          <button className="fileSaveBtn" onClick={downloadCalculationFile}>
            💾 Save Bill File
          </button>

          <button className="fileOpenBtn" onClick={requestOpenCalculationFile}>
            📂 Open Saved Bill
          </button>

          <input
            ref={calculationFileInputRef}
            className="calculationFileInput"
            type="file"
            accept=".ttcalc,.json,application/json"
            onChange={openCalculationFile}
          />

          <div
            className={`fileSaveStatus ${
              hasUnsavedFileChanges ? "unsaved" : "saved"
            }`}
          >
            {hasUnsavedFileChanges ? "⚠ Save bill file before leaving" : fileSaveStatus}
          </div>

          <button className="draftBtn" onClick={() => setShowDrafts(true)}>
            📂 Saved Drafts
          </button>

          <button className="jpgBtn" onClick={shareJpg}>
            🖼️ JPG ആയി ഷെയർ ചെയ്യുക
          </button>

          <button className="waBtn" onClick={downloadJpg}>
            🖼️ JPG ഡൗൺലോഡ് ചെയ്യുക
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
          <img src="/tt-logo-horizontal.png" alt="Tried & True" className="billLogo" />
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
          <div className="billCustomerLeft">
            <strong>ഉപഭോക്താവിന്റെ പേര്</strong>
            <span>:</span>
            <b>{customerName || "-"}</b>
          </div>

          <div className="billDate">
            <strong>Date :</strong>
            <span>{todayText()}</span>
          </div>
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
              <th>ബാലൻസ്</th>
            </tr>
          </thead>

          <tbody>
            {openingBalanceAmount > 0 && (
              <tr className="billOpeningBalanceRow">
                <td>1</td>
                <td style={{ fontWeight: 900 }}>മുൻ ബാലൻസ്</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td style={{ fontWeight: 900 }}>₹ {formatMoney(openingBalanceAmount)}</td>
                <td style={{ fontWeight: 900 }}>₹ {formatMoney(openingBalanceAmount)}</td>
              </tr>
            )}

            {advanceAmount > 0 && (
              <tr className="billTransactionRow">
                <td>{openingBalanceAmount > 0 ? 2 : 1}</td>
                <td style={{ fontWeight: 900 }}>അഡ്വാൻസ്</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td className="billDeductionAmount">− ₹ {formatMoney(advanceAmount)}</td>
                <td style={{ fontWeight: 900 }}>
                  ₹ {formatMoney(openingBalanceAmount - advanceAmount)}
                </td>
              </tr>
            )}

            {activeRows.map((row, index) => (
              <tr key={row.originalIndex}>
                <td>
                  {index +
                    1 +
                    (openingBalanceAmount > 0 ? 1 : 0) +
                    (advanceAmount > 0 ? 1 : 0)}
                </td>
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
                <td>₹ {formatMoney(rentalBalances[index])}</td>
              </tr>
            ))}

            {activeTransports.map((transport, index) => {
              const amount = Math.max(Number(transport.amount || 0), 0);
              if (amount <= 0) return null;

              return (
                <tr className="billTransactionRow" key={`transport-${transport.originalIndex}`}>
                  <td>
                    {index +
                      1 +
                      (openingBalanceAmount > 0 ? 1 : 0) +
                      (advanceAmount > 0 ? 1 : 0) +
                      activeRows.length}
                  </td>
                  <td style={{ fontWeight: 900 }}>
                    ഗതാഗത ചെലവ്{transport.place.trim() ? ` - ${transport.place.trim()}` : ""}
                  </td>
                  <td>—</td>
                  <td>—</td>
                  <td>
                    {transport.date || "—"}
                    {transport.date && (
                      <>
                        <br />
                        <small>{formatDate(transport.date)}</small>
                      </>
                    )}
                  </td>
                  <td>—</td>
                  <td>—</td>
                  <td>₹ {formatMoney(amount)}</td>
                  <td>₹ {formatMoney(transportBalances[index])}</td>
                </tr>
              );
            })}

            {activePayments.map((payment, index) => {
              const amount = Math.max(Number(payment.amount || 0), 0);
              if (amount <= 0) return null;

              return (
                <tr className="billTransactionRow billCashReceivedRow" key={`payment-${payment.originalIndex}`}>
                  <td>
                    {index +
                      1 +
                      (openingBalanceAmount > 0 ? 1 : 0) +
                      (advanceAmount > 0 ? 1 : 0) +
                      activeRows.length +
                      activeTransports.filter((item) => Number(item.amount || 0) > 0).length}
                  </td>
                  <td style={{ fontWeight: 900 }}>
                    വരവ്{payment.note.trim() ? ` - ${payment.note.trim()}` : ""}
                  </td>
                  <td>—</td>
                  <td>—</td>
                  <td>
                    {payment.date || "—"}
                    {payment.date && (
                      <>
                        <br />
                        <small>{formatDate(payment.date)}</small>
                      </>
                    )}
                  </td>
                  <td>—</td>
                  <td>—</td>
                  <td className="billDeductionAmount">− ₹ {formatMoney(amount)}</td>
                  <td>₹ {formatMoney(paymentBalances[index])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {activeHolidays.length > 0 && (
          <div className="billHolidayNote">
            <strong>അവധി ദിവസങ്ങളായതിനാൽ ഈ ദിവസങ്ങൾക്ക് വാടക ഈടാക്കിയിട്ടില്ല:</strong>
            {activeHolidays.map((holiday) => (
              <span key={`${holiday.date}-${holiday.originalIndex}`}>
                {new Date(holiday.date + "T00:00:00").toLocaleDateString("en-IN")}
                {` - ${holiday.name.trim() || "അവധി"}`}
              </span>
            ))}
          </div>
        )}

        <div className="billBottom">
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

          <div className="billBottomSpacer" aria-hidden="true" />

          <div className="billTotals">
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
