import AppShell from "@/components/AppShell";

export default function RentalCollectionPage() {
  return (
    <AppShell
      title="Rental Collection"
      subtitle="Customer balances, rentals and payment collection"
    >
      <div
        style={{
          width: "100%",
          minHeight: "calc(100dvh - 108px)",
          overflow: "hidden",
          border: "1px solid #e3e7ed",
          borderRadius: "16px",
          background: "#ffffff",
        }}
      >
        <iframe
          src="https://rental-collection-online.vercel.app"
          title="T&T Rental Collection"
          loading="eager"
          allow="clipboard-read; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{
            display: "block",
            width: "100%",
            height: "calc(100dvh - 108px)",
            minHeight: "620px",
            border: 0,
            background: "#ffffff",
          }}
        />
      </div>
    </AppShell>
  );
}
