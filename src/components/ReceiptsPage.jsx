import ReceiptModal from "./ReceiptModal";
export default function ReceiptsPage({
  appStyles,
  buttonStyle,
  inputStyle,
  pageTitleStyle,
  pageSubtitleStyle,
  isPhone,
  isFoldable,
  years,
  expenseCategories,
  receiptYear,
  setReceiptYear,
  receiptCategory,
  setReceiptCategory,
  receiptSearch,
  setReceiptSearch,
  receiptItems,
  showAllReceipts,
  setShowAllReceipts,
  selectedReceipt,
  setSelectedReceipt,
  setActiveView,
  currency,
  onLogout,
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: appStyles.background,
        color: appStyles.text,
        padding: 20,
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          textAlign: "center",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <div style={pageTitleStyle}>Receipts</div>
          <div style={pageSubtitleStyle}>
            Receipt gallery and quick preview
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
            flexWrap: "wrap",
            width: "100%",
            marginTop: 12,
          }}
        >
          <button
            onClick={() => setActiveView("dashboard")}
            style={{
              ...buttonStyle,
              background: appStyles.accent,
              color: "#1a1633",
            }}
          >
            Dashboard
          </button>

          <button
            onClick={() => setActiveView("performance")}
            style={{
              ...buttonStyle,
              background: "rgba(255,255,255,0.12)",
              color: appStyles.text,
            }}
          >
            Performance
          </button>

          <button
            onClick={onLogout}
            style={{
              ...buttonStyle,
              background: "rgba(255,255,255,0.12)",
              color: appStyles.text,
            }}
          >
            Log Out
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isPhone
            ? "1fr"
            : isFoldable
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(4, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <select
          value={receiptYear}
          onChange={(e) => setReceiptYear(e.target.value)}
          style={inputStyle}
        >
          <option value="all">All Years</option>

          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select
          value={receiptCategory}
          onChange={(e) => setReceiptCategory(e.target.value)}
          style={inputStyle}
        >
          <option value="all">All Categories</option>

          {expenseCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <input
          value={receiptSearch}
          onChange={(e) => setReceiptSearch(e.target.value)}
          placeholder="Search receipts"
          style={inputStyle}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isPhone
            ? "1fr"
            : isFoldable
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(4, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        {receiptItems.length === 0 ? (
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: `1px solid ${appStyles.cardBorder}`,
              borderRadius: 18,
              padding: 18,
            }}
          >
            No receipts yet.
          </div>
        ) : (
          <>
            {receiptItems
              .slice(0, showAllReceipts ? receiptItems.length : 3)
              .map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${appStyles.cardBorder}`,
                    borderRadius: 18,
                    padding: 18,
                    display: "grid",
                    gridTemplateColumns: "80px 1fr",
                    gap: 14,
                    alignItems: "center",
                  }}
                >
                  <img
                    src={item.receipt}
                    alt="Receipt"
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: "cover",
                      borderRadius: 10,
                      background: "#fff",
                    }}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>
                      {item.category}
                    </div>

                    <div
                      style={{
                        color: appStyles.muted,
                        marginTop: 4,
                      }}
                    >
                      {item.date}
                    </div>

                    <div style={{ marginTop: 4 }}>
                      {currency(item.amount)}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      setSelectedReceipt(item.receipt)
                    }
                    style={{
                      ...buttonStyle,
                      background: appStyles.accent2,
                      color: "#06203a",
                      gridColumn: "1 / -1",
                      justifySelf: "center",
                      marginTop: 8,
                    }}
                  >
                    View
                  </button>
                </div>
              ))}
          </>
        )}

        {receiptItems.length > 3 ? (
          <button
            type="button"
            onClick={() =>
              setShowAllReceipts((prev) => !prev)
            }
            style={{
              ...buttonStyle,
              background: "rgba(255,255,255,0.12)",
              color: appStyles.text,
              marginTop: 12,
              width: "100%",
              gridColumn: "1 / -1",
            }}
          >
            {showAllReceipts
              ? "Show Most Recent 3"
              : "Show All Receipts"}
          </button>
                ) : null}
      </div>

      <ReceiptModal
        selectedReceipt={selectedReceipt}
        setSelectedReceipt={setSelectedReceipt}
      />
    </div>
  );
}