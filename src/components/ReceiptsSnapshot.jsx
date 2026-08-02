export default function ReceiptsSnapshot({
  receiptItems,
  appStyles,
  buttonStyle,
  setActiveView,
  setSelectedReceipt,
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${appStyles.cardBorder}`,
        borderRadius: 18,
        padding: 18,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>
          Receipts Snapshot
        </div>

        <div style={{ color: "#dbeafe", marginTop: 6 }}>
          Newest receipt-backed expenses.
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <button
          onClick={() => setActiveView("receipts")}
          style={{
            ...buttonStyle,
            background: "rgba(255,255,255,0.12)",
            color: appStyles.text,
          }}
        >
          Open Gallery
        </button>
      </div>

      {receiptItems.length === 0 ? (
        <div style={{ color: appStyles.muted, textAlign: "center" }}>
          No receipts yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {receiptItems.slice(0, 3).map((item) => (
            <div
              key={item.id}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${appStyles.cardBorder}`,
                borderRadius: 14,
                padding: 12,
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}
            >
              <img
                src={item.receipt}
                alt="Receipt"
                style={{
                  width: 64,
                  height: 64,
                  objectFit: "cover",
                  borderRadius: 10,
                  background: "#fff",
                }}
              />

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{item.category}</div>
                <div style={{ color: appStyles.muted }}>{item.date}</div>
              </div>

              <button
                onClick={() => setSelectedReceipt(item.receipt)}
                style={{
                  ...buttonStyle,
                  background: appStyles.accent2,
                  color: "#06203a",
                }}
              >
                View
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}