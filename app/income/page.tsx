import AppShell from "@/components/AppShell";
import MoneyTracker from "@/components/MoneyTracker";

export default function IncomePage() {
  return (
    <AppShell title="Income Tracker" subtitle="Choose GPay, Cash or Staff Collection">
      <MoneyTracker type="income" />
    </AppShell>
  );
}
