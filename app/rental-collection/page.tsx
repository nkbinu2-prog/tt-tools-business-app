import AppShell from "../../components/AppShell";
import styles from "./RentalCollection.module.css";

export default function RentalCollectionPage() {
  return (
    <AppShell
      title="Rental Collection"
      subtitle="Manage rental collection reminders and follow-ups"
    >
      <section className={styles.frameWrap}>
        <iframe
          className={styles.frame}
          src="https://rental-collection-online.vercel.app"
          title="T&T Rental Collection"
          loading="eager"
          allow="clipboard-read; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>
    </AppShell>
  );
}
