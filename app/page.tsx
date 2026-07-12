const CALCULATOR_URL =
  process.env.NEXT_PUBLIC_RENTAL_CALCULATOR_URL?.trim() ||
  "https://tt-rental-calculator-rental-pro.vercel.app";

export default function RentalCalculatorPage() {
  return (
    <main
      style={{
        width: "100%",
        minWidth: 0,
        height: "100dvh",
        overflow: "hidden",
        background: "#eef5ff",
      }}
    >
      <iframe
        src={CALCULATOR_URL}
        title="T&T Rental Calculator"
        loading="eager"
        allow="clipboard-read; clipboard-write; web-share"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          border: 0,
          background: "#eef5ff",
        }}
      />
    </main>
  );
}
