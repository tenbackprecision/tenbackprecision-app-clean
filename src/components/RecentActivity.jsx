import { useState } from "react";

export default function RecentActivity({
  activityItems = [],
  appStyles,
  currency,
}) {
  const [showAll, setShowAll] = useState(false);

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
          Recent Activity
        </div>

        <div
          style={{
            color: "#dbeafe",
            marginTop: 6,
          }}
        >
          Latest movement across income and expenses.
        </div>
      </div>

      {activityItems.length === 0 ? (
        <div
          style={{
            color: appStyles.muted,
            textAlign: "center",
          }}
        >
          No activity yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {activityItems
            .slice(0, showAll ? activityItems.length : 3)
            .map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${appStyles.cardBorder}`,
                  borderRadius: 14,
                  padding: 12,
                  minHeight: 78,
                  width: "95%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {item.title}
                  </div>

                  <div
                    style={{
                      color: appStyles.muted,
                      fontSize: 14,
                    }}
                  >
                    {item.type} • {item.date}
                  </div>

                  {item.note ? (
                    <div style={{ marginTop: 6 }}>
                      {item.note}
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    fontWeight: 900,
                    color:
                      item.amount >= 0
                        ? appStyles.success
                        : "#ff8a8a",
                  }}
                >
                  {currency(item.amount)}
                </div>
              </div>
            ))}

          {activityItems.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              style={{
                padding: "12px 18px",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.12)",
                cursor: "pointer",
                fontWeight: 900,
                fontSize: 16,
                background: "rgba(255,255,255,0.12)",
                color: appStyles.text,
                marginTop: 12,
                width: "100%",
              }}
            >
              {showAll ? "Show Less" : "Show All"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}