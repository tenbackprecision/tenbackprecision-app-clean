export default function SyncIndicator({ dataLoading }) {
  if (!dataLoading) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 20,
        bottom: 20,
        background: "rgba(15,23,42,0.95)",
        color: "#ffffff",
        padding: "10px 14px",
        borderRadius: 12,
        fontWeight: 800,
        zIndex: 999,
      }}
    >
      Syncing data...
    </div>
  );
}