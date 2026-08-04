import { useState } from "react";

export default function IncomeEntries({
  filteredIncome = [],
  appStyles,
  buttonStyle,
  currency,
  setEditingIncomeId,
  setIncomeForm,
  removeIncome,
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
          Income Entries
        </div>

        <div style={{ color: "#dbeafe", marginTop: 6 }}>
          Recent income activity.
        </div>
      </div>

      {filteredIncome.length === 0 ? (
        <div style={{ color: appStyles.muted, textAlign: "center" }}>
          No income found.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filteredIncome
            .slice(0, showAll ? filteredIncome.length : 3)
            .map((item) => (
              <div
                key={item.id}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${appStyles.cardBorder}`,
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.source}</div>

                    <div
                      style={{
                        color: appStyles.muted,
                        fontSize: 14,
                      }}
                    >
                      {item.date}
                    </div>
                  </div>

                  <div
                    style={{
                      fontWeight: 900,
                      color: appStyles.success,
                    }}
                  >
                    {currency(item.amount)}
                  </div>
                </div>

                {item.note ? (
                  <div style={{ marginTop: 8 }}>{item.note}</div>
                ) : null}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 10,
                    marginTop: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={() => {
                      setEditingIncomeId(item.id);

                      setIncomeForm({
                        date: item.date || "",
                        source:
                          item.source || "Tournament Winnings",
                        amount: String(item.amount || ""),
                        note: item.note || "",
                      });

                      document
                        .getElementById("income-form")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                    style={{
                      ...buttonStyle,
                      background: appStyles.accent,
                      color: "#1a1633",
                      padding: "8px 12px",
                    }}
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => removeIncome(item)}
                    style={{
                      ...buttonStyle,
                      background: "#ff6b6b",
                      color: "#fff",
                      padding: "8px 12px",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

          {filteredIncome.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              style={{
                ...buttonStyle,
                background: "rgba(255,255,255,0.12)",
                color: appStyles.text,
                marginTop: 12,
                width: "100%",
              }}
            >
              {showAll ? "Show Most Recent 3" : "Show All Income"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}