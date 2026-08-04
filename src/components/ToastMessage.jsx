export default function ToastMessage({ toast }) {
  if (!toast) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        background:
          toast.type === "error"
            ? "rgba(239,68,68,0.95)"
            : "rgba(34,197,94,0.95)",
        color: "#ffffff",
        padding: "14px 18px",
        borderRadius: 14,
        fontWeight: 800,
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        zIndex: 1000,
      }}
    >
      {toast.message}
    </div>
  );
}