import AppShell from "../../components/AppShell";

const CALCULATOR_URL =
  process.env.NEXT_PUBLIC_RENTAL_CALCULATOR_URL?.trim() ||
  "https://tt-rental-calculator-rental-pro.vercel.app";

export default function RentalCalculatorPage() {
  return (
    <AppShell
      title="Rental Calculator"
      subtitle="Calculate tool rental amounts and prepare customer bills"
    >
      <section
        style={{
          width: "100%",
          minWidth: 0,
          height: "calc(100dvh - 145px)",
          minHeight: "620px",
          overflow: "hidden",
          borderRadius: "14px",
          background: "#eef5ff",
        }}
      >
        <iframe
          src={CALCULATOR_URL}
          title="T&T Rental Calculator"
          loading="eager"
          allow="clipboard-read; clipboard-write; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            border: 0,
            background: "#eef5ff",
          }}
        />
      </section>
    </AppShell>
  );
}
