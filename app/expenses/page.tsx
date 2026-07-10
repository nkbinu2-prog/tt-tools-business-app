import AppShell from "@/components/AppShell";
import MoneyTracker from "@/components/MoneyTracker";

export default function ExpensesPage() {
  return (
    <AppShell title="Expense Tracker" subtitle="Expense details, amount and notes">
      <MoneyTracker type="expense" />
    </AppShell>
  );
}
