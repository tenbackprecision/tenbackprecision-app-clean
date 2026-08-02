import { useState } from "react";

export default function ExpenseEntries({
  filteredExpenses = [],
  appStyles,
  buttonStyle,
  currency,
  setEditingExpenseId,
  setExpenseForm,
  removeExpense,
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
          Expense Entries
        </div>

        <div style={{ color: "#dbeafe", marginTop: 6 }}>
          Recent spending activity.
        </div>
      </div>

      {filteredExpenses.length === 0 ? (
        <div style={{ color: appStyles.muted, textAlign: "center" }}>
          No expenses found.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filteredExpenses
            .slice(0, showAll ? filteredExpenses.length : 3)
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
                    <div style={{ fontWeight: 800 }}>{item.category}</div>
                    <div style={{ color: appStyles.muted, fontSize: 14 }}>
                      {item.date}
                    </div>
                  </div>

                  <div style={{ fontWeight: 900 }}>
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
                      setEditingExpenseId(item.id);

                      setExpenseForm({
                        date: item.date || "",
                        category: item.category || "Tournament",
                        amount: String(item.amount || ""),
                        note: item.note || "",
                        receipt: item.receipt || "",
                      });

                      document
                        .getElementById("expense-form")
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
                    onClick={() => removeExpense(item)}
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

          {filteredExpenses.length > 3 ? (
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
              {showAll ? "Show Most Recent 3" : "Show All Expenses"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}