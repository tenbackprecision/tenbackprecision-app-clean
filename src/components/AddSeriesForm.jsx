import React from "react";
import LaneBoardSelector from "./LaneBoardSelector";


export default function AddSeriesForm({
  editingSeriesId,
  newSeries,
  setNewSeries,
  performanceTypes,
  inputStyle,
  isPhone,
  isFoldable,
  equipment,
  equipmentOptions,
  buttonStyle,
  appStyles,
  saveSeries,
  resetSeriesForm,
}) {
  return (
    <>
      <SectionTitle
        title={editingSeriesId ? "Editing Series" : "Add Series"}
        subtitle={
          editingSeriesId
            ? "Update this saved series, then tap Update Series."
            : "House, event type, games, and notes"
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isPhone
            ? "1fr"
            : isFoldable
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <input type="date" value={newSeries.date} onChange={(e) => setNewSeries((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
        <input type="text" placeholder="House" value={newSeries.house} onChange={(e) => setNewSeries((prev) => ({ ...prev, house: e.target.value }))} style={inputStyle} />

        <select value={newSeries.type} onChange={(e) => setNewSeries((prev) => ({ ...prev, type: e.target.value }))} style={inputStyle}>
          {performanceTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>

        <input type="text" placeholder="Oil Pattern" value={newSeries.oilPattern} onChange={(e) => setNewSeries((prev) => ({ ...prev, oilPattern: e.target.value }))} style={inputStyle} />

        <select value={newSeries.primaryBallId} onChange={(e) => {
          const selected = equipment.find((ball) => ball.id === e.target.value);
          setNewSeries({ ...newSeries, primaryBallId: e.target.value, primaryBall: selected?.name || "" });
        }} style={inputStyle}>
          <option value="">Select Primary Ball</option>
          {equipmentOptions.map((ball) => (
            <option key={ball.id} value={ball.id}>{ball.name}</option>
          ))}
        </select>

        <select value={newSeries.secondaryBallId} onChange={(e) => {
          const selected = equipment.find((ball) => ball.id === e.target.value);
          setNewSeries({ ...newSeries, secondaryBallId: e.target.value, secondaryBall: selected?.name || "" });
        }} style={inputStyle}>
          <option value="">Select Secondary Ball</option>
          {equipmentOptions.map((ball) => (
            <option key={ball.id} value={ball.id}>{ball.name}</option>
          ))}
        </select>

        <input type="text" placeholder="Feet" value={newSeries.feet} onChange={(e) => setNewSeries((prev) => ({ ...prev, feet: e.target.value }))} style={inputStyle} />
        <input type="text" placeholder="Target" value={newSeries.target} onChange={(e) => setNewSeries((prev) => ({ ...prev, target: e.target.value }))} style={inputStyle} />
        <input type="text" placeholder="Breakpoint" value={newSeries.breakpoint} onChange={(e) => setNewSeries((prev) => ({ ...prev, breakpoint: e.target.value }))} style={inputStyle} />
        <input type="text" placeholder="Surface" value={newSeries.surface} onChange={(e) => setNewSeries((prev) => ({ ...prev, surface: e.target.value }))} style={inputStyle} />

        <textarea
          placeholder="Transition Note"
          rows={3}
          value={newSeries.transitionNote}
          onChange={(e) => setNewSeries((prev) => ({ ...prev, transitionNote: e.target.value }))}
          style={{ ...inputStyle, gridColumn: "1 / -1", resize: "vertical" }}
        />

        <textarea
          placeholder="Notes"
          rows={4}
          value={newSeries.notes}
          onChange={(e) => setNewSeries((prev) => ({ ...prev, notes: e.target.value }))}
          style={{ ...inputStyle, gridColumn: "1 / -1", resize: "vertical" }}
        />

<LaneBoardSelector
  value={newSeries.boardLayout}
  onChange={(layout) =>
    setNewSeries((prev) => ({
      ...prev,
      boardLayout: layout,
    }))
  }
pinLayout={newSeries.pinLayout}
onPinLayoutChange={(pins) =>
  setNewSeries((prev) => ({
    ...prev,
    pinLayout: pins,
  }))
}
  appStyles={appStyles}
  buttonStyle={buttonStyle}
/>
        {newSeries.games.map((game, index) => (
          <input
            key={index}
            type="number"
            placeholder={`Game ${index + 1}`}
            value={game}
            onChange={(e) => {
              const updatedGames = [...newSeries.games];
              updatedGames[index] = e.target.value;
              setNewSeries((prev) => ({ ...prev, games: updatedGames }));
            }}
            style={inputStyle}
          />
        ))}

        <button
          type="button"
          onClick={() => setNewSeries((prev) => ({ ...prev, games: [...prev.games, ""] }))}
          style={{ ...buttonStyle, background: "rgba(255,255,255,0.12)", color: appStyles.text }}
        >
          + Add Game
        </button>

        <button
          type="button"
          onClick={() => setNewSeries((prev) => ({
            ...prev,
            games: prev.games.length > 1 ? prev.games.slice(0, -1) : prev.games,
          }))}
          style={{ ...buttonStyle, background: "rgba(255,255,255,0.12)", color: appStyles.text }}
        >
          - Remove Game
        </button>

        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={saveSeries}
            style={{ ...buttonStyle, background: appStyles.accent2, color: "#06203a" }}
          >
            {editingSeriesId ? "Update Series" : "Save Series"}
          </button>

          {editingSeriesId ? (
            <button
              type="button"
              onClick={resetSeriesForm}
              style={{ ...buttonStyle, background: "rgba(255,255,255,0.18)", color: appStyles.text }}
            >
              Cancel Edit
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 14 }}>
      <div style={{ fontSize: 24, fontWeight: 900 }}>{title}</div>
      {subtitle ? <div style={{ color: "#dbeafe", marginTop: 6 }}>{subtitle}</div> : null}
    </div>
  );
}