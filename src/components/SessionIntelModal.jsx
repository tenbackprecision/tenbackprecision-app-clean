export default function SessionIntelModal({
  selectedSessionIntel,
  setSelectedSessionIntel,
  appStyles,
  buttonStyle,
}) {
  if (!selectedSessionIntel) return null;

  return (
    <div
      onClick={() => setSelectedSessionIntel(null)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "100%",
          background: appStyles.card,
          border: `1px solid ${appStyles.cardBorder}`,
          borderRadius: 24,
          padding: 20,
          boxShadow: appStyles.glowBlue,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 24, fontWeight: 900 }}>
            🎳 Session Intel
          </div>
          <div style={{ color: "#dbeafe", marginTop: 6 }}>
            {`${selectedSessionIntel.house || "Unknown House"} · ${
              selectedSessionIntel.date || "No Date"
            }`}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {[
            ["Oil Pattern", selectedSessionIntel.oilPattern],
            ["Primary Ball", selectedSessionIntel.primaryBall],
            ["Secondary Ball", selectedSessionIntel.secondaryBall],
            ["Feet", selectedSessionIntel.feet],
            ["Target", selectedSessionIntel.target],
            ["Breakpoint", selectedSessionIntel.breakpoint],
            ["Surface", selectedSessionIntel.surface],
            ["Transition", selectedSessionIntel.transitionNote],
            ["Notes", selectedSessionIntel.notes],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                borderBottom: `1px solid ${appStyles.cardBorder}`,
                paddingBottom: 8,
              }}
            >
              <strong>{label}</strong>
              <span style={{ color: appStyles.muted, textAlign: "right" }}>
                {value || "—"}
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSelectedSessionIntel(null)}
          style={{
            ...buttonStyle,
            width: "100%",
            marginTop: 18,
            background: appStyles.accent,
            color: "#1a1633",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}