"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./AppShell.module.css";

type IconName = "notes" | "money" | "movement" | "trip" | "download" | "calculator" | "collection";

type NavItem = {
  href: string;
  label: string;
  mobileLabel: string;
  icon: IconName;
};

const navItems: NavItem[] = [
  { href: "/expenses", label: "Income & Expenses", mobileLabel: "Money", icon: "money" },
  { href: "/tools-movement", label: "Tools Movement", mobileLabel: "Moving", icon: "movement" },
  { href: "/trip-cash", label: "Trip Cash", mobileLabel: "Trip Cash", icon: "trip" },
  { href: "/downloads", label: "Download Reports", mobileLabel: "Download", icon: "download" },
  { href: "/rental-collection", label: "Rental Collection", mobileLabel: "Collection", icon: "collection" },
  { href: "/rental-calculator", label: "Rental Calculator", mobileLabel: "Calculator", icon: "calculator" },
  { href: "/reminders", label: "Notes & Reminders", mobileLabel: "Notes", icon: "notes" },
];

function NavIcon({ name }: { name: IconName }) {
  if (name === "notes") {
    return <svg viewBox="0 0 24 24"><path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
  }
  if (name === "money") {
    return <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 15h10"/><path d="m8 12 2-2 2 2"/><path d="m16 12-2 2-2-2"/></svg>;
  }
  if (name === "movement") {
    return <svg viewBox="0 0 24 24"><path d="M3 7h12"/><path d="m12 4 3 3-3 3"/><path d="M21 17H9"/><path d="m12 14-3 3 3 3"/><circle cx="5" cy="17" r="2"/><circle cx="19" cy="7" r="2"/></svg>;
  }
  if (name === "trip") {
    return <svg viewBox="0 0 24 24"><path d="M3 16V8a2 2 0 0 1 2-2h10l4 4h2v6"/><circle cx="7" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><path d="M9 17h7M15 6v4h4"/></svg>;
  }
  if (name === "download") {
    return <svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14a2 2 0 0 0 2-2v-2"/><path d="M3 17v2a2 2 0 0 0 2 2"/></svg>;
  }
  if (name === "collection") {
    return <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 14h3M15 14h2"/><circle cx="17.5" cy="7" r="1"/></svg>;
  }
  return <svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h2m4 0h2M8 15h2m4 0h2M8 19h2m4 0h2"/></svg>;
}

export default function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/reminders" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.logo} src="/tt-logo-horizontal.png" alt="Tried & True Rent a Tool" />
        </Link>
        <nav className={styles.nav} aria-label="Main navigation">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}>
                <span className={styles.iconWrap}><NavIcon name={item.icon} /></span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.mobileLogo} src="/tt-logo-horizontal.png" alt="Tried & True Rent a Tool" />
          <div className={styles.heading}>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </main>

      <nav className={styles.mobileNav} aria-label="Mobile navigation">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`${styles.mobileLink} ${active ? styles.mobileActive : ""}`}>
              <span className={styles.iconWrap}><NavIcon name={item.icon} /></span>
              <span>{item.mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
