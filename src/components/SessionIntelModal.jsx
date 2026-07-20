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
  ["Event Type", selectedSessionIntel.type || selectedSessionIntel.event],
  [
    "Games",
    (selectedSessionIntel.games || [])
      .filter((game) => Number(game) > 0)
      .join(" · "),
  ],
  [
  "Trend",
  (() => {
    const games = (selectedSessionIntel.games || [])
      .map(Number)
      .filter((g) => g > 0);

    if (games.length < 2) return "—";

    const first = games[0];
    const last = games[games.length - 1];

    if (last > first) return "📈 Finished Strong";
    if (last < first) return "📉 Slowed Down";

    return "➡️ Stayed Even";
  })(),
],
[
  "Finish Change",
  (() => {
    const games = (selectedSessionIntel.games || [])
      .map(Number)
      .filter((g) => g > 0);

    if (games.length < 2) return "—";

    const change = games[games.length - 1] - games[0];

    if (change > 0) return `+${change} pins`;
    if (change < 0) return `${change} pins`;

    return "No change";
  })(),
],
  ["Series Total", selectedSessionIntel.total],
  ["Games Bowled", (selectedSessionIntel.games || []).length],
  ["Average", selectedSessionIntel.average],
  ["Performance",
  selectedSessionIntel.average >= 220 ? "🔥 Outstanding" :
  selectedSessionIntel.average >= 200 ? "✅ Excellent" :
  selectedSessionIntel.average >= 180 ? "👍 Solid" :
  selectedSessionIntel.average >= 160 ? "📈 Improving" :
  "🎯 Practice Focus"],
  ["High Game", selectedSessionIntel.highGame],
  [
  "Best Game",
  (() => {
    const games = (selectedSessionIntel.games || [])
      .map(Number)
      .filter((g) => g > 0);

    if (!games.length) return "—";

    return `Game ${games.indexOf(Math.max(...games)) + 1}`;
  })(),
],
[
  "Low Game",
  (() => {
    const games = (selectedSessionIntel.games || [])
      .map(Number)
      .filter((g) => g > 0);

    if (!games.length) return "—";

    return Math.min(...games);
  })(),
],
[
  "Worst Game",
  (() => {
    const games = (selectedSessionIntel.games || [])
      .map(Number)
      .filter((g) => g > 0);

    if (!games.length) return "—";

    return `Game ${games.indexOf(Math.min(...games)) + 1}`;
  })(),
],

  [
  "Score Spread",
  (() => {

    const games = (selectedSessionIntel.games || [])
      .map(Number)
      .filter((g) => g > 0);

    if (games.length < 2) return "—";

    return `${Math.max(...games) - Math.min(...games)} pins`;
  })(),
],[
  "Consistency",
  (() => {
    const games = (selectedSessionIntel.games || [])
      .map(Number)
      .filter((g) => g > 0);

    if (games.length < 2) return "—";

    const spread = Math.max(...games) - Math.min(...games);

    if (spread <= 15) return "🎯 Elite";
    if (spread <= 30) return "✅ Consistent";
    if (spread <= 45) return "👍 Fair";
    return "📈 Needs Work";
  })(),
],
[
  "Session Grade",
  (() => {
    const avg = Number(selectedSessionIntel.average || 0);

    if (avg >= 230) return "🏆 A+";
    if (avg >= 220) return "🥇 A";
    if (avg >= 210) return "⭐ A-";
    if (avg >= 200) return "✅ B+";
    if (avg >= 190) return "👍 B";
    if (avg >= 180) return "👌 C";
    if (avg >= 170) return "📈 D";
    return "🎯 F";
  })(),
],
[
  "Clean Games",
  selectedSessionIntel.cleanGames ?? "—",
],
[
  "Focus Next Session",
  (() => {
    const avg = Number(selectedSessionIntel.average || 0);

    if (avg >= 220) return "Stay aggressive and trust your moves.";
    if (avg >= 200) return "Fine tune transitions and spare shooting.";
    if (avg >= 180) return "Focus on spare conversions.";
    if (avg >= 160) return "Improve shot repeatability.";
    return "Slow down, hit your target, and make good shots.";
  })(),
],
[
  "Session Length",
  `${(selectedSessionIntel.games || []).filter((g) => Number(g) > 0).length} Games`,
],
[
  "Lane Play",
  selectedSessionIntel.feet && selectedSessionIntel.target
    ? `${selectedSessionIntel.feet} → ${selectedSessionIntel.target}`
    : "—",
],
[
  "Ball Strategy",
  selectedSessionIntel.secondaryBall
    ? `${selectedSessionIntel.primaryBall} → ${selectedSessionIntel.secondaryBall}`
    : selectedSessionIntel.primaryBall || "—",
],
[
  "Equipment Notes",
  selectedSessionIntel.surface
    ? `${selectedSessionIntel.primaryBall || "Ball"} (${selectedSessionIntel.surface})`
    : "—",
],
[
  "Release",
  selectedSessionIntel.breakpoint
    ? `${selectedSessionIntel.target || "—"} → ${selectedSessionIntel.breakpoint}`
    : "—",
],
  ["Oil Pattern", selectedSessionIntel.oilPattern],
  ["Primary Ball", selectedSessionIntel.primaryBall],
  ["Secondary Ball", selectedSessionIntel.secondaryBall],
  ["Feet", selectedSessionIntel.feet],
  ["Target", selectedSessionIntel.target],
  ["Breakpoint", selectedSessionIntel.breakpoint],
  ["Surface", selectedSessionIntel.surface],
  ["Transition", selectedSessionIntel.transitionNote],
  ["Notes", selectedSessionIntel.notes],
  [
  "Coach's Notes",
  (() => {
    const avg = Number(selectedSessionIntel.average || 0);
    const spread = (() => {
      const games = (selectedSessionIntel.games || [])
        .map(Number)
        .filter((g) => g > 0);

      if (games.length < 2) return 0;

      return Math.max(...games) - Math.min(...games);
    })();

    if (avg >= 220)
      return "Elite scoring pace. Keep trusting your execution.";

    if (avg >= 200 && spread <= 20)
      return "Excellent consistency. Small adjustments only.";

    if (avg >= 200)
      return "Scoring well. Focus on reducing game-to-game swings.";

    if (avg >= 180)
      return "Solid session. Spare shooting could unlock higher scores.";

    if (spread > 50)
      return "Large score swings. Watch transitions and ball changes.";

    return "Treat this as a learning session. Build consistency first.";
  })(),
],
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