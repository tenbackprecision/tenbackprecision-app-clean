import { useState } from "react";

export default function RecentSeries({
  sortedSeries = [],
  appStyles,
  onEdit,
  onDelete,
}) {
  const [showAll, setShowAll] = useState(false);


  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>
          Recent Series
        </div>

        <div
          style={{
            color: "#dbeafe",
            marginTop: 6,
          }}
        >
          Latest saved house and score data
        </div>
      </div>

      {sortedSeries.length === 0 ? (
        <div
          style={{
            color: appStyles.muted,
            textAlign: "center",
          }}
        >
          No series yet.
        </div>
      ) : (
        <div
  style={{
    display: "grid",
    gap: 12,
  }}
>
 {(showAll ? sortedSeries : sortedSeries.slice(0, 3)).map((series) => (
    <div
      key={series.id}
      style={{
        background: appStyles.card,
        border: `1px solid ${appStyles.cardBorder}`,
        borderRadius: 18,
        padding: 16,
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 18,
          marginBottom: 6,
        }}
      >
        {series.house || "Unknown House"}
      </div>

      <div
        style={{
          color: appStyles.muted,
          fontSize: 14,
        }}
      >
        {series.date || "No date"} • {series.type || series.event || "Practice"} •{" "}
        {(series.games || []).length} games
      </div>
<div
  style={{
    marginTop: 10,
    fontWeight: 800,
    fontSize: 16,
  }}
>
  Scores: {(series.games || []).join(" • ") || "No scores"}
</div>

<div
  style={{
    marginTop: 6,
    color: appStyles.accent,
    fontWeight: 900,
  }}
>
  Average: {Number(series.average || 0).toFixed(1)}
</div>
<div
  style={{
    marginTop: 6,
    color: appStyles.muted,
    fontWeight: 700,
  }}
>
  Total: {Number(series.total || 0)} • High Game:{" "}
  {Number(series.highGame || 0)}
</div>
{(series.oilPattern || series.ballUsed) && (
  <div
    style={{
      marginTop: 6,
      color: appStyles.muted,
      fontSize: 14,
    }}
  >
    {series.oilPattern && (
      <span>Oil Pattern: {series.oilPattern}</span>
    )}

    {series.oilPattern && series.ballUsed && (
      <span> • </span>
    )}

    {series.ballUsed && (
      <span>Ball: {series.ballUsed}</span>
    )}
  </div>
)}
<div
  style={{
    marginTop: 12,
    display: "flex",
    justifyContent: "center",
    gap: 8,
  }}
>
  <button
    type="button"
    onClick={() => onEdit(series)}
    style={{
      padding: "8px 12px",
      borderRadius: 10,
      border: `1px solid ${appStyles.accent}`,
      background: "transparent",
      color: appStyles.accent,
      fontWeight: 800,
      cursor: "pointer",
    }}
  >
    Edit
  </button>

  <button
    type="button"
    onClick={() => onDelete(series.id)}
    style={{
      padding: "8px 12px",
      borderRadius: 10,
      border: `1px solid ${appStyles.danger}`,
      background: "transparent",
      color: appStyles.danger,
      fontWeight: 800,
      cursor: "pointer",
    }}
  >
    Delete
  </button>
</div>
    </div>
  ))}
{sortedSeries.length > 3 && (
  <button
    type="button"
    onClick={() => setShowAll((prev) => !prev)}
    style={{
      padding: "10px 14px",
      borderRadius: 12,
      border: `1px solid ${appStyles.cardBorder}`,
      background: appStyles.panel,
      color: appStyles.text,
      fontWeight: 800,
      cursor: "pointer",
    }}
  >
    {showAll ? "Show Less" : `Show All (${sortedSeries.length})`}
  </button>
)}
</div>
      )}
    </>
  );
}