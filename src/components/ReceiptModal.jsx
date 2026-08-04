export default function ReceiptModal({
  selectedReceipt,
  setSelectedReceipt,
}) {
  if (!selectedReceipt) return null;

  return (
    <div
      onClick={() => setSelectedReceipt(null)}
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
      <img
        src={selectedReceipt}
        alt="Receipt full"
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          borderRadius: 14,
          background: "#fff",
        }}
      />
    </div>
  );
}