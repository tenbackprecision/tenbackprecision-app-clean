import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function AnalyticsPage({
  onBack,
  filteredSeries,
  performanceSummary,
  houseStats,
  personalRecords,
  averageProgressionData,
  rollingAverageData,
  appStyles,
  isPhone,
}) {
  return (
    <div style={{ padding: 24 }}>
      <button onClick={onBack}>
        ← Dashboard
      </button>

      <h1>Analytics</h1>

<div
  style={{
    marginTop: 24,
    display: "grid",
    gridTemplateColumns: isPhone ? "1fr" : "repeat(3, 1fr)",
    gap: 16,
  }}
>
  <div
    style={{
      background: appStyles.card,
      border: `1px solid ${appStyles.cardBorder}`,
      borderRadius: 18,
      padding: 20,
      textAlign: "center",
    }}
  >
    <div style={{ color: appStyles.muted }}>Overall Average</div>
    <div style={{ fontSize: 32, fontWeight: 900 }}>
      {performanceSummary.overallAverage}
    </div>
  </div>

  <div
    style={{
      background: appStyles.card,
      border: `1px solid ${appStyles.cardBorder}`,
      borderRadius: 18,
      padding: 20,
      textAlign: "center",
    }}
  >
    <div style={{ color: appStyles.muted }}>Best Game</div>
    <div style={{ fontSize: 32, fontWeight: 900 }}>
      {performanceSummary.bestGame}
    </div>
  </div>

  <div
    style={{
      background: appStyles.card,
      border: `1px solid ${appStyles.cardBorder}`,
      borderRadius: 18,
      padding: 20,
      textAlign: "center",
    }}
  >
    <div style={{ color: appStyles.muted }}>Best Series</div>
    <div style={{ fontSize: 32, fontWeight: 900 }}>
      {performanceSummary.bestSeries}
    </div>
  </div>
</div>
<div
  style={{
    marginTop: 28,
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 18,
    padding: 20,
  }}
>
  <h2 style={{ marginTop: 0 }}>Average Progression</h2>

  <ResponsiveContainer width="100%" height={320}>
    <LineChart data={averageProgressionData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="month" />
      <YAxis />
      <Tooltip />
      <Line
        type="monotone"
        dataKey="average"
        stroke={appStyles.accent}
        strokeWidth={3}
      />
    </LineChart>
  </ResponsiveContainer>

</div>
<div
  style={{
    marginTop: 28,
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 18,
    padding: 20,
  }}
>
  <h2 style={{ marginTop: 0 }}>Rolling 10-Series Average</h2>

  <ResponsiveContainer width="100%" height={320}>
    <LineChart data={rollingAverageData}>
      <CartesianGrid strokeDasharray="3 3" />

      <XAxis
        dataKey="date"
        tickFormatter={(value) =>
          new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        }
      />

      <YAxis domain={["dataMin - 5", "dataMax + 5"]} />

      <Tooltip
        labelFormatter={(value) =>
          new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        }
        formatter={(value) => [value, "Rolling Average"]}
      />

      <Line
        type="monotone"
        dataKey="average"
        stroke={appStyles.success}
        strokeWidth={3}
        dot={{ r: 4 }}
        activeDot={{ r: 7 }}
        name="Rolling Average"
      />
    </LineChart>
  </ResponsiveContainer>
</div>
<div
  style={{
    marginTop: 28,
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 18,
    padding: 20,
  }}
>
  <h2 style={{ marginTop: 0 }}>House Statistics</h2>

  {houseStats.map((house) => (
    <div
      key={house.house}
      style={{
        marginBottom: 18,
        paddingBottom: 18,
        borderBottom: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <h3>{house.house}</h3>

      <div>Average: {house.average}</div>
      <div>Games: {house.games}</div>
      <div>Series: {house.series}</div>
      <div>High Game: {house.highGame}</div>
      <div>High Series: {house.highSeries}</div>
      <div>200+ Games: {house.games200}</div>
      <div>Best Month: {house.bestMonth}</div>
    </div>
  ))}
</div>
<div
  style={{
    marginTop: 28,
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 18,
    padding: 20,
  }}
>
  <h2 style={{ marginTop: 0 }}>🏆 Personal Records</h2>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: isPhone ? "1fr" : "repeat(3, 1fr)",
      gap: 16,
    }}
  >
    <div>
      <strong>High Game</strong>
      <div>{personalRecords.highGame}</div>
    </div>

    <div>
      <strong>High Series</strong>
      <div>{personalRecords.highSeries}</div>
    </div>

    <div>
      <strong>Overall Average</strong>
      <div>{personalRecords.average}</div>
    </div>

    <div>
      <strong>Total Games</strong>
      <div>{personalRecords.totalGames}</div>
    </div>

    <div>
      <strong>Total Series</strong>
      <div>{personalRecords.totalSeries}</div>
    </div>

    <div>
      <strong>200+ Games</strong>
      <div>{personalRecords.games200}</div>
    </div>
  </div>
</div>
    </div>
  );
}