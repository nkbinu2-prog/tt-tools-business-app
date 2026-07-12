"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import AppShell from "@/components/AppShell";
import {
  STORAGE_KEYS,
  formatCurrency,
  todayIso,
  type MoneyEntry,
  type MovementRecord,
  type TripCashEntry,
} from "@/lib/business-data";
import { useStoredList } from "@/lib/useStoredList";

type MoneyEntryWithShop = MoneyEntry & {
  shop?: string;
};

type Selection = {
  money: boolean;
  movements: boolean;
  tripCash: boolean;
};

function monthStartIso() {
  return `${todayIso().slice(0, 7)}-01`;
}

function movementDate(item: MovementRecord) {
  if (item.step1?.at) return item.step1.at.slice(0, 10);

  const created = new Date(item.createdAt);
  return Number.isNaN(created.getTime())
    ? ""
    : created.toISOString().slice(0, 10);
}

function movementPath(item: MovementRecord) {
  return [item.step1, item.step2, item.step3, item.step4]
    .map((step) => step?.location?.trim())
    .filter((location): location is string => Boolean(location))
    .join(" → ");
}

function movementNotes(item: MovementRecord) {
  return [item.startNotes, item.step1?.notes, item.step2?.notes, item.step3?.notes, item.step4?.notes]
    .map((note) => note?.trim())
    .filter((note): note is string => Boolean(note))
    .filter((note, index, all) => all.indexOf(note) === index)
    .join(" | ");
}

function inDateRange(date: string, fromDate: string, toDate: string) {
  return Boolean(date) && date >= fromDate && date <= toDate;
}

export default function DownloadsPage() {
  const { items: expenseItems, loaded: expensesLoaded } =
    useStoredList<MoneyEntryWithShop>(STORAGE_KEYS.expenses);
  const { items: incomeItems, loaded: incomeLoaded } =
    useStoredList<MoneyEntryWithShop>(STORAGE_KEYS.income);
  const { items: movementItems, loaded: movementsLoaded } =
    useStoredList<MovementRecord>(STORAGE_KEYS.movements);
  const { items: tripCashItems, loaded: tripCashLoaded } =
    useStoredList<TripCashEntry>(STORAGE_KEYS.tripCash);

  const [fromDate, setFromDate] = useState(monthStartIso);
  const [toDate, setToDate] = useState(todayIso);
  const [selected, setSelected] = useState<Selection>({
    money: true,
    movements: true,
    tripCash: true,
  });

  const filteredExpenses = useMemo(
    () =>
      expenseItems.filter((item) =>
        inDateRange(item.date, fromDate, toDate)
      ),
    [expenseItems, fromDate, toDate]
  );

  const filteredIncome = useMemo(
    () =>
      incomeItems.filter((item) =>
        inDateRange(item.date, fromDate, toDate)
      ),
    [fromDate, incomeItems, toDate]
  );

  const filteredMovements = useMemo(
    () =>
      movementItems.filter((item) =>
        inDateRange(movementDate(item), fromDate, toDate)
      ),
    [fromDate, movementItems, toDate]
  );

  const filteredTripCash = useMemo(
    () =>
      tripCashItems.filter((item) =>
        inDateRange(item.date, fromDate, toDate)
      ),
    [fromDate, toDate, tripCashItems]
  );

  const incomeTotal = useMemo(
    () => filteredIncome.reduce((sum, item) => sum + item.amount, 0),
    [filteredIncome]
  );

  const expenseTotal = useMemo(
    () => filteredExpenses.reduce((sum, item) => sum + item.amount, 0),
    [filteredExpenses]
  );

  const tripCashTotal = useMemo(
    () => filteredTripCash.reduce((sum, item) => sum + item.amount, 0),
    [filteredTripCash]
  );

  const hasSelection =
    selected.money || selected.movements || selected.tripCash;

  const dataLoaded =
    expensesLoaded && incomeLoaded && movementsLoaded && tripCashLoaded;

  function toggle(name: keyof Selection) {
    setSelected((current) => ({
      ...current,
      [name]: !current[name],
    }));
  }

  function selectAll() {
    setSelected({
      money: true,
      movements: true,
      tripCash: true,
    });
  }

  function clearAll() {
    setSelected({
      money: false,
      movements: false,
      tripCash: false,
    });
  }

  function addWorksheet(
    workbook: XLSX.WorkBook,
    name: string,
    rows: Array<Array<string | number>>,
    columnWidths: number[],
    headerRow: number
  ) {
    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    worksheet["!cols"] = columnWidths.map((width) => ({ wch: width }));

    const lastRow = Math.max(rows.length, headerRow);
    const lastColumn = Math.max(
      ...rows.map((row) => row.length),
      columnWidths.length
    );

    if (lastColumn > 0 && lastRow >= headerRow) {
      worksheet["!autofilter"] = {
        ref: XLSX.utils.encode_range({
          s: { r: headerRow - 1, c: 0 },
          e: { r: lastRow - 1, c: lastColumn - 1 },
        }),
      };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }

  function downloadReport() {
    if (
      !dataLoaded ||
      !hasSelection ||
      !fromDate ||
      !toDate ||
      fromDate > toDate
    ) {
      return;
    }

    const workbook = XLSX.utils.book_new();
    const periodText = `Period: ${fromDate} to ${toDate}`;

    if (selected.money) {
      const moneyRows: Array<Array<string | number>> = [
        ["T&T Tools - Income & Expense"],
        [periodText],
        [],
        [
          "Income Total",
          incomeTotal,
          "Expense Total",
          expenseTotal,
          "Net",
          incomeTotal - expenseTotal,
        ],
        [],
        ["Date", "Type", "Details", "Shop", "Mode", "Amount", "Notes"],
      ];

      const moneyRecords = [
        ...filteredIncome.map((item) => ({
          date: item.date,
          type: "Income",
          details: "Income",
          shop: item.shop || "",
          mode: item.mode || "",
          amount: item.amount,
          notes: item.notes || "",
        })),
        ...filteredExpenses.map((item) => ({
          date: item.date,
          type: "Expense",
          details: item.details || "Expense",
          shop: "",
          mode: "",
          amount: item.amount,
          notes: item.notes || "",
        })),
      ].sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.type.localeCompare(b.type)
      );

      moneyRecords.forEach((item) => {
        moneyRows.push([
          item.date,
          item.type,
          item.details,
          item.shop,
          item.mode,
          item.amount,
          item.notes,
        ]);
      });

      addWorksheet(
        workbook,
        "Income & Expense",
        moneyRows,
        [13, 12, 28, 18, 16, 14, 32],
        6
      );
    }

    if (selected.movements) {
      const movementRows: Array<Array<string | number>> = [
        ["T&T Tools - Tools Movement"],
        [periodText],
        [],
        [
          "Date",
          "Status",
          "Tool",
          "Qty",
          "Home Shop",
          "Movement Path",
          "Final Action",
          "Notes",
        ],
      ];

      [...filteredMovements]
        .sort((a, b) =>
          movementDate(a).localeCompare(movementDate(b))
        )
        .forEach((item) => {
          movementRows.push([
            movementDate(item),
            item.stage === 4 ? "Completed" : `Stage ${item.stage}`,
            item.tool,
            item.qty,
            item.homeShop,
            movementPath(item),
            item.step4?.finalAction || "",
            movementNotes(item),
          ]);
        });

      addWorksheet(
        workbook,
        "Tools Movement",
        movementRows,
        [13, 14, 26, 9, 18, 42, 20, 36],
        4
      );
    }

    if (selected.tripCash) {
      const pendingTotal = filteredTripCash
        .filter((item) => item.status === "Pending")
        .reduce((sum, item) => sum + item.amount, 0);

      const receivedTotal = filteredTripCash
        .filter((item) => item.status === "Received")
        .reduce((sum, item) => sum + item.amount, 0);

      const tripCashRows: Array<Array<string | number>> = [
        ["T&T Tools - Trip Cash"],
        [periodText],
        [],
        [
          "Total Trip Cash",
          tripCashTotal,
          "Pending",
          pendingTotal,
          "Received",
          receivedTotal,
        ],
        [],
        [
          "Date",
          "Customer",
          "Shop",
          "Location",
          "Trips",
          "Amount",
          "Status",
          "Received At",
          "Notes",
        ],
      ];

      [...filteredTripCash]
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach((item) => {
          tripCashRows.push([
            item.date,
            item.customer,
            item.shop === "Other" ? item.customShop : item.shop,
            item.location,
            item.trips,
            item.amount,
            item.status,
            item.receivedAt || "",
            item.notes || "",
          ]);
        });

      addWorksheet(
        workbook,
        "Trip Cash",
        tripCashRows,
        [13, 24, 18, 24, 10, 14, 13, 22, 34],
        6
      );
    }

    XLSX.writeFile(
      workbook,
      `T&T-Business-Report-${fromDate}-to-${toDate}.xlsx`,
      { compression: true }
    );
  }

  return (
    <AppShell
      title="Download Reports"
      subtitle="Choose a date range and select the sections to include"
    >
      <div className="report-page">
        <section className="report-panel">
          <div className="date-grid">
            <label>
              <span>From Date</span>
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </label>

            <label>
              <span>To Date</span>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </label>
          </div>

          <div className="selection-heading">
            <strong>Select Sections</strong>

            <div className="small-actions">
              <button type="button" onClick={selectAll}>
                Select All
              </button>
              <button type="button" onClick={clearAll}>
                Clear
              </button>
            </div>
          </div>

          <div className="section-grid">
            <button
              type="button"
              className={`section-option ${selected.money ? "selected" : ""}`}
              onClick={() => toggle("money")}
              aria-pressed={selected.money}
            >
              <span className="check">{selected.money ? "✓" : ""}</span>
              <span>
                <strong>Income & Expense</strong>
                <small className="section-stat">
                  {filteredIncome.length} income · {formatCurrency(incomeTotal)}
                </small>
                <small className="section-stat">
                  {filteredExpenses.length} expense · {formatCurrency(expenseTotal)}
                </small>
              </span>
            </button>

            <button
              type="button"
              className={`section-option ${
                selected.movements ? "selected" : ""
              }`}
              onClick={() => toggle("movements")}
              aria-pressed={selected.movements}
            >
              <span className="check">{selected.movements ? "✓" : ""}</span>
              <span>
                <strong>Tools Movement</strong>
                <small className="section-stat">
                  {filteredMovements.length} movement records · no cash
                </small>
              </span>
            </button>

            <button
              type="button"
              className={`section-option ${
                selected.tripCash ? "selected" : ""
              }`}
              onClick={() => toggle("tripCash")}
              aria-pressed={selected.tripCash}
            >
              <span className="check">{selected.tripCash ? "✓" : ""}</span>
              <span>
                <strong>Trip Cash</strong>
                <small className="section-stat">
                  {filteredTripCash.length} records · {formatCurrency(tripCashTotal)}
                </small>
              </span>
            </button>
          </div>

          {!dataLoaded ? (
            <div className="loading-message">
              Loading cloud records…
            </div>
          ) : null}

          {fromDate > toDate ? (
            <div className="error-message">
              From Date cannot be later than To Date.
            </div>
          ) : null}

          <button
            type="button"
            className="download-button"
            onClick={downloadReport}
            disabled={!dataLoaded || !hasSelection || fromDate > toDate}
          >
            Download Excel File
          </button>

          <p className="file-note">
            One Excel file will be created. Each selected section will
            appear in its own sheet.
          </p>
        </section>
      </div>

      <style jsx>{`
        .report-page {
          max-width: 920px;
          margin: 0 auto;
        }

        .report-panel {
          padding: 18px;
          border: 1px solid #e0e4ea;
          border-radius: 16px;
          background: #ffffff;
        }

        .date-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .date-grid label {
          display: grid;
          gap: 6px;
        }

        .date-grid span,
        .selection-heading strong {
          color: #374151;
          font-size: 14px;
          font-weight: 800;
        }

        .date-grid input {
          width: 100%;
          min-height: 46px;
          border: 1px solid #ccd2db;
          border-radius: 10px;
          padding: 0 12px;
          background: #ffffff;
          color: #111827;
          font: inherit;
          font-size: 15px;
          font-weight: 700;
        }

        .selection-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 22px;
        }

        .small-actions {
          display: flex;
          gap: 6px;
        }

        .small-actions button {
          min-height: 34px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 0 10px;
          background: #f8fafc;
          color: #374151;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .section-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 10px;
        }

        .section-option {
          min-width: 0;
          display: grid;
          grid-template-columns: 30px minmax(0, 1fr);
          align-items: center;
          gap: 9px;
          min-height: 88px;
          border: 1px solid #d7dce4;
          border-radius: 12px;
          padding: 12px;
          background: #ffffff;
          color: #374151;
          text-align: left;
          cursor: pointer;
        }

        .section-option.selected {
          border-color: #9e0000;
          background: #fff4f4;
        }

        .check {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border: 2px solid #b8bec8;
          border-radius: 7px;
          color: #ffffff;
          background: #ffffff;
          font-size: 17px;
          font-weight: 900;
        }

        .selected .check {
          border-color: #9e0000;
          background: #9e0000;
        }

        .section-option strong,
        .section-option small {
          display: block;
        }

        .section-option strong {
          color: #111827;
          font-size: 14px;
          font-weight: 850;
        }

        .section-option small {
          margin-top: 4px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 650;
          line-height: 1.25;
        }

        .section-option .section-stat {
          font-size: 13px;
          font-weight: 800;
          line-height: 1.3;
        }

        .loading-message,
        .error-message {
          margin-top: 14px;
          border-radius: 9px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 800;
        }

        .loading-message {
          background: #fff7d6;
          color: #7a4b00;
        }

        .error-message {
          background: #fff0f0;
          color: #b00000;
        }

        .download-button {
          width: 100%;
          min-height: 50px;
          margin-top: 18px;
          border: 0;
          border-radius: 11px;
          background: linear-gradient(135deg, #8d0000, #d30000);
          color: #ffffff;
          font: inherit;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
        }

        .download-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .file-note {
          margin: 9px 0 0;
          color: #6b7280;
          font-size: 11px;
          font-weight: 600;
          text-align: center;
        }

        @media (max-width: 700px) {
          .report-panel {
            padding: 12px;
            border-radius: 12px;
          }

          .date-grid {
            gap: 8px;
          }

          .date-grid input {
            min-height: 42px;
            padding: 0 8px;
            font-size: 13px;
          }

          .section-grid {
            grid-template-columns: 1fr;
            gap: 7px;
          }

          .section-option {
            min-height: 64px;
            padding: 9px;
          }

        }
      `}</style>
    </AppShell>
  );
}
