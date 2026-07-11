"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import MoneyTracker from "@/components/MoneyTracker";
import ui from "@/components/MobileBusiness.module.css";

type TrackerType = "expense" | "income";

export default function IncomeExpensesPage() {
  const [activeType, setActiveType] = useState<TrackerType>("expense");

  useEffect(() => {
    const selectedView = new URLSearchParams(window.location.search).get("view");
    if (selectedView === "income") {
      setActiveType("income");
    }
  }, []);

  function changeType(nextType: TrackerType) {
    setActiveType(nextType);

    const nextUrl =
      nextType === "income" ? "/expenses?view=income" : "/expenses";

    window.history.replaceState(null, "", nextUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <AppShell
      title="Income & Expenses"
      subtitle="Use the toggle to move between expense and income tracking"
    >
      <div className={ui.moneyTrackerPage}>
        <div className={ui.moneyTrackerToggleCard}>
          <div className={ui.moneyTrackerToggle}>
            <button
              type="button"
              className={`${ui.moneyTrackerToggleButton} ${
                activeType === "expense"
                  ? `${ui.moneyTrackerToggleActive} ${ui.moneyTrackerExpenseActive}`
                  : ""
              }`}
              onClick={() => changeType("expense")}
              aria-pressed={activeType === "expense"}
            >
              <span className={ui.moneyTrackerToggleIcon}>₹−</span>
              <span>
                <strong>Expense</strong>
                <small>Money going out</small>
              </span>
            </button>

            <button
              type="button"
              className={`${ui.moneyTrackerToggleButton} ${
                activeType === "income"
                  ? `${ui.moneyTrackerToggleActive} ${ui.moneyTrackerIncomeActive}`
                  : ""
              }`}
              onClick={() => changeType("income")}
              aria-pressed={activeType === "income"}
            >
              <span className={ui.moneyTrackerToggleIcon}>₹+</span>
              <span>
                <strong>Income</strong>
                <small>Money coming in</small>
              </span>
            </button>
          </div>

          <div
            className={`${ui.moneyTrackerCurrentLabel} ${
              activeType === "income"
                ? ui.moneyTrackerCurrentIncome
                : ui.moneyTrackerCurrentExpense
            }`}
          >
            {activeType === "expense"
              ? "Expense tracker is active"
              : "Income tracker is active"}
          </div>
        </div>

        <MoneyTracker key={activeType} type={activeType} />
      </div>
    </AppShell>
  );
}
