export const SHOPS = [
  "Karuvannur",
  "Ollur",
  "Kachery",
  "Mulayam Rd",
  "Pattikkad",
] as const;

export const SERVICE_CENTRES = [
  "Brotech",
  "Siju Poochatty",
  "Prijo Kachery",
  "MJ Tools",
  "Global",
  "iBell",
  "Vincent",
] as const;

export const MOVEMENT_DESTINATIONS = [
  ...SHOPS,
  ...SERVICE_CENTRES,
  "Other",
] as const;

export const STORAGE_KEYS = {
  reminders: "tt-business-notes-v2",
  expenses: "tt-business-expenses-v2",
  income: "tt-business-income-v2",
  movements: "tt-business-movements-v3",
  tripCash: "tt-business-trip-cash-v1",
} as const;

export type NoteColor = "yellow" | "blue" | "green" | "pink" | "white";

export type ReminderItem = {
  id: string;
  title: string;
  details: string;
  hasReminder: boolean;
  date: string;
  time: string;
  completed: boolean;
  color: NoteColor;
  notifiedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type MoneyEntry = {
  id: string;
  date: string;
  details: string;
  amount: number;
  mode: "GPay" | "Cash" | "Staff Collection" | "";
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type MovementStep = {
  at: string;
  location: string;
  notes: string;
};

export type MovementRecord = {
  id: string;
  tool: string;
  qty: number;
  homeShop: string;
  firstDestination: string;
  startNotes: string;
  stage: 1 | 2 | 3 | 4;
  step1: MovementStep;
  step2?: MovementStep;
  step3?: MovementStep;
  step4?: MovementStep & {
    finalAction: "Returned Home" | "Another Shop" | "Kept There" | "Not Returning";
  };
  createdAt: number;
  updatedAt: number;
};

export type MovementDraftRow = {
  id: string;
  tool: string;
  qty: number;
  homeShop: string;
  destination: string;
  notes: string;
};

export type TripCashEntry = {
  id: string;
  customer: string;
  shop: string;
  customShop: string;
  location: string;
  amount: number;
  trips: number;
  date: string;
  notes: string;
  status: "Pending" | "Received";
  receivedAt?: string;
  createdAt: number;
  updatedAt: number;
};

export function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function todayIso() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function nowLocalDateTime() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function formatCurrency(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function formatDisplayDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function createMovementDraftRow(): MovementDraftRow {
  return {
    id: makeId("move-row"),
    tool: "",
    qty: 1,
    homeShop: SHOPS[0],
    destination: SERVICE_CENTRES[0],
    notes: "",
  };
}
