import AddSeriesForm from "./AddSeriesForm";
import RecentSeries from "./RecentSeries";
import SessionIntelModal from "./SessionIntelModal";
import ToastMessage from "./ToastMessage";

function StatCard({ label, value, subValue, valueColor, appStyles }) {
  return (
    <div
      style={{
        background: appStyles.card,
        border: `1px solid ${appStyles.cardBorder}`,
        borderRadius: 24,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: appStyles.glowBlue,
        padding: 18,
        textAlign: "center",
      }}
    >
      <div
        style={{
          color: appStyles.muted,
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: valueColor || appStyles.text,
          marginBottom: 8,
        }}
      >
        {value}
      </div>

      <div style={{ color: appStyles.muted }}>{subValue}</div>
    </div>
  );
}

export default function PerformancePage({
  appStyles,
  buttonStyle,
  inputStyle,
  pageTitleStyle,
  pageSubtitleStyle,
  isPhone,
  isFoldable,
  lastUpdatedPerformance,
  setActiveView,
  performanceSummary,
  perfFilters,
  setPerfFilters,
  seriesList,
  performanceTypes,
  editingSeriesId,
  newSeries,
  setNewSeries,
  equipment,
  equipmentOptions,
  saveSeries,
  resetSeriesForm,
  addSeriesRef,
  showEquipmentManager,
  setShowEquipmentManager,
  equipmentForm,
  setEquipmentForm,
  saveEquipment,
  editingEquipmentId,
  setEditingEquipmentId,
  emptyEquipmentForm,
  showBowlrImport,
  setShowBowlrImport,
  bowlrImportRef,
  handleBowlrImportFile,
  bowlrPreview,
  importBowlrGames,
  deleteImportedBowlrGames,
  filteredSeries,
  handleEditSeries,
  handleDelete,
  selectedSessionIntel,
  setSelectedSessionIntel,
  toast,
  renderFab,
  onLogout,
}) {
const sortedSeries = [...filteredSeries].sort((a, b) =>
  String(b.date).localeCompare(String(a.date))
);

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
    <div style={{ textAlign: "center", marginBottom: 18 }}>
      <div style={pageTitleStyle}>🎳 Performance</div>

      <div style={pageSubtitleStyle}>
        Track houses, games, and series without junk-drawering the money side.
      </div>

      <div
        style={{
          color: appStyles.muted,
          fontSize: 13,
          marginTop: 6,
        }}
      >
        Last updated: {lastUpdatedPerformance}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 14,
        }}
      >
        <button
          type="button"
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
          type="button"
          onClick={() => setActiveView("receipts")}
          style={{
            ...buttonStyle,
            background: "rgba(255,255,255,0.12)",
            color: appStyles.text,
          }}
        >
          Receipts
        </button>

        <button
          type="button"
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
        : "repeat(3, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  }}
>
  <StatCard
    label="Series Logged"
    value={String(performanceSummary.totalSeries)}
    subValue="Tracked and ready"
    appStyles={appStyles}
  />

  <StatCard
    label="Overall Avg"
    value={String(performanceSummary.overallAverage)}
    subValue="Across all saved games"
    appStyles={appStyles}
  />

  <StatCard
    label="Last 5 Avg"
    value={String(performanceSummary.last5Average)}
    subValue={performanceSummary.trend}
    valueColor={performanceSummary.trendColor}
    appStyles={appStyles}
  />

  <StatCard
    label="Last 10 Avg"
    value={String(performanceSummary.last10Average)}
    subValue="Recent performance window"
    appStyles={appStyles}
  />

  <StatCard
    label="Best Series"
    value={String(performanceSummary.bestSeries)}
    subValue="Highest total"
    appStyles={appStyles}
  />

  <StatCard
    label="Best Game"
    value={String(performanceSummary.bestGame)}
    subValue="High score"
    appStyles={appStyles}
  />
</div>
<div
  style={{
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
    marginBottom: 18,
  }}
>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: isPhone
        ? "1fr"
        : isFoldable
          ? "repeat(2, minmax(0, 1fr))"
          : "repeat(3, minmax(0, 1fr))",
      gap: 12,
    }}
  >
    <select
      value={perfFilters.house}
      onChange={(e) =>
        setPerfFilters({
          ...perfFilters,
          house: e.target.value,
        })
      }
      style={inputStyle}
    >
      <option value="">All Houses</option>

      {[...new Set(seriesList.map((s) => s.house))]
        .filter(Boolean)
        .sort()
        .map((house) => (
          <option key={house} value={house}>
            {house}
          </option>
        ))}
    </select>

    <select
      value={perfFilters.event}
      onChange={(e) =>
        setPerfFilters({
          ...perfFilters,
          event: e.target.value,
        })
      }
      style={inputStyle}
    >
      <option value="">All Events</option>

      {[
        ...new Set([
          ...performanceTypes,
          ...seriesList.map((s) => s.type || s.event),
        ]),
      ]
        .filter(Boolean)
        .sort()
        .map((event) => (
          <option key={event} value={event}>
            {event}
          </option>
        ))}
    </select>

    <select
      value={perfFilters.year}
      onChange={(e) =>
        setPerfFilters({
          ...perfFilters,
          year: e.target.value,
        })
      }
      style={inputStyle}
    >
      <option value="">All Years</option>

      {[...new Set(seriesList.map((s) => String(s.date || "").slice(0, 4)))]
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a))
        .map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
    </select>
  </div>
</div>
<RecentSeries
  sortedSeries={sortedSeries}
  appStyles={appStyles}
  onEdit={(series) => {
  handleEditSeries(series);

  setTimeout(() => {
    addSeriesRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 0);
}}
  onDelete={handleDelete}
/>

<div ref={addSeriesRef}>
  <AddSeriesForm
    editingSeriesId={editingSeriesId}
    newSeries={newSeries}
    setNewSeries={setNewSeries}
    performanceTypes={performanceTypes}
    inputStyle={inputStyle}
    isPhone={isPhone}
    isFoldable={isFoldable}
    equipment={equipment}
    equipmentOptions={equipmentOptions}
    buttonStyle={buttonStyle}
    appStyles={appStyles}
    saveSeries={saveSeries}
    resetSeriesForm={resetSeriesForm}
  />
</div>
<div id="equipment-manager"
  style={{
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 24,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: appStyles.glowPurple,
    padding: 18,
    marginBottom: 18,
  }}
>
  <button
    type="button"
    onClick={() => setShowEquipmentManager((prev) => !prev)}
    style={{
      width: "100%",
      border: "none",
      background: "transparent",
      color: appStyles.text,
      cursor: "pointer",
      padding: 0,
      marginBottom: showEquipmentManager ? 24 : 0,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          flex: 1,
          textAlign: "center",
          paddingLeft: 26,
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 900 }}>
          🎒 Equipment Manager
        </div>

        <div style={{ color: appStyles.muted, marginTop: 6 }}>
          Build your digital bowling bag
        </div>
      </div>

      <div style={{ fontSize: 20 }}>
        {showEquipmentManager ? "▲" : "▼"}
      </div>
    </div>
  </button>

  {showEquipmentManager && (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isPhone
            ? "1fr"
            : "repeat(2, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <input
          placeholder="Ball Name"
          value={equipmentForm.name}
          onChange={(e) =>
            setEquipmentForm((prev) => ({
              ...prev,
              name: e.target.value,
            }))
          }
          style={inputStyle}
        />

        <input
          placeholder="Manufacturer"
          value={equipmentForm.manufacturer}
          onChange={(e) =>
            setEquipmentForm((prev) => ({
              ...prev,
              manufacturer: e.target.value,
            }))
          }
          style={inputStyle}
        />

        <input
          placeholder="Coverstock"
          value={equipmentForm.coverstock}
          onChange={(e) =>
            setEquipmentForm((prev) => ({
              ...prev,
              coverstock: e.target.value,
            }))
          }
          style={inputStyle}
        />

        <input
          placeholder="Surface"
          value={equipmentForm.surface}
          onChange={(e) =>
            setEquipmentForm((prev) => ({
              ...prev,
              surface: e.target.value,
            }))
          }
          style={inputStyle}
        />

        <input
          type="date"
          value={equipmentForm.purchaseDate}
          onChange={(e) =>
            setEquipmentForm((prev) => ({
              ...prev,
              purchaseDate: e.target.value,
            }))
          }
          style={inputStyle}
        />

        <select
          value={equipmentForm.status}
          onChange={(e) =>
            setEquipmentForm((prev) => ({
              ...prev,
              status: e.target.value,
            }))
          }
          style={inputStyle}
        >
          <option>Active</option>
          <option>Retired</option>
        </select>
      </div>

      <button
        type="button"
        onClick={saveEquipment}
        style={{
          ...buttonStyle,
          background: appStyles.accent,
          color: "#1a1633",
          width: "100%",
        }}
      >
        {editingEquipmentId ? "Update Ball" : "+ Add Ball"}
      </button>

      {editingEquipmentId ? (
        <button
          type="button"
          onClick={() => {
            setEditingEquipmentId(null);
            setEquipmentForm(emptyEquipmentForm);
          }}
          style={{
            ...buttonStyle,
            background: "rgba(255,255,255,0.12)",
            color: appStyles.text,
            width: "100%",
            marginTop: 10,
          }}
        >
          Cancel Edit
        </button>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {equipment.length === 0 ? (
          <div style={{ color: appStyles.muted, textAlign: "center" }}>
            No equipment added yet.
          </div>
        ) : (
          equipment.map((ball) => (
            <div
              key={ball.id}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${appStyles.cardBorder}`,
                borderRadius: 18,
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18 }}>
                🎳 {ball.name}
              </div>

              <div style={{ color: appStyles.muted, marginTop: 4 }}>
                {[ball.manufacturer, ball.coverstock, ball.surface]
                  .filter(Boolean)
                  .join(" · ") || "No details yet"}
              </div>

              <div style={{ marginTop: 8, color: appStyles.accent }}>
                {ball.status || "Active"}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 10,
                  marginTop: 14,
                }}
              >
                <div>
                  <strong>🎳 Games</strong>
                  <br />
                  {ball.games || 0}
                </div>

                <div>
                  <strong>📈 Average</strong>
                  <br />
                  {ball.average || 0}
                </div>

                <div>
                  <strong>🔥 High Game</strong>
                  <br />
                  {ball.highGame || 0}
                </div>

                <div>
                  <strong>🏆 Best Series</strong>
                  <br />
                  {ball.bestSeries || 0}
                </div>

                <div>
                  <strong>🏠 Favorite House</strong>
                  <br />
                  {ball.favoriteHouse || "—"}
                </div>

                <div>
                  <strong>📅 Last Used</strong>
                  <br />
                  {ball.lastUsed || "—"}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 10,
                  marginTop: 12,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setEditingEquipmentId(ball.id);
                    setEquipmentForm({
                      ...emptyEquipmentForm,
                      name: ball.name || "",
                      manufacturer: ball.manufacturer || "",
                      weight: ball.weight || "",
                      core: ball.core || "",
                      coverstock: ball.coverstock || "",
                      finish: ball.finish || "",
                      surface: ball.surface || "",
                      layout: ball.layout || "",
                      purchaseDate: ball.purchaseDate || "",
                      status: ball.status || "Active",
                      image: ball.image || "",
                      games: ball.games || 0,
                      average: ball.average || 0,
                      highGame: ball.highGame || 0,
                      bestSeries: ball.bestSeries || 0,
                    });
                
setTimeout(() => {
  document
    .getElementById("equipment-manager")
    ?.scrollIntoView({
      behavior: "smooth",
      block: "start", 
    });
}, 0);
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
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )}
</div>
<div
  style={{
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 24,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: appStyles.glowBlue,
    padding: 18,
    marginBottom: 18,
  }}
>
  <button
    type="button"
    onClick={() => setShowBowlrImport((prev) => !prev)}
    style={{
      width: "100%",
      border: "none",
      background: "transparent",
      color: appStyles.text,
      cursor: "pointer",
      padding: 0,
      marginBottom: showBowlrImport ? 24 : 0,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          flex: 1,
          textAlign: "center",
          paddingLeft: 26,
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 900 }}>
          📥 Bowlr Import
        </div>

        <div style={{ color: appStyles.muted, marginTop: 6 }}>
          Import bowling history from a Bowlr CSV
        </div>
      </div>

      <div style={{ fontSize: 20 }}>
        {showBowlrImport ? "▲" : "▼"}
      </div>
    </div>
  </button>
{showBowlrImport && (
  <>
    <input
      ref={bowlrImportRef}
      type="file"
      accept=".csv"
      style={{ display: "none" }}
      onChange={(e) => handleBowlrImportFile(e.target.files?.[0])}
    />

    <button
      type="button"
      onClick={() => bowlrImportRef.current?.click()}
      style={{
        ...buttonStyle,
        background: appStyles.accent,
        color: "#1a1633",
        width: "100%",
      }}
    >
      Upload Bowlr CSV
    </button>
  </>
)}
{bowlrPreview ? (
  <div
    style={{
      marginTop: 16,
      display: "grid",
      gridTemplateColumns: isPhone
        ? "1fr"
        : "repeat(3, minmax(0, 1fr))",
      gap: 10,
    }}
  >
    <StatCard
      label="Games Found"
      value={String(bowlrPreview.games)}
      subValue="From Bowlr export"
      appStyles={appStyles}
    />

    <StatCard
      label="Houses"
      value={String(bowlrPreview.houses.length)}
      subValue="Centers found"
      appStyles={appStyles}
    />

    <StatCard
      label="Balls"
      value={String(bowlrPreview.balls.length)}
      subValue="Ball IDs found"
      appStyles={appStyles}
    />

    <StatCard
      label="Leagues"
      value={String(bowlrPreview.leagues.length)}
      subValue="League names"
      appStyles={appStyles}
    />

    <StatCard
      label="Tournaments"
      value={String(bowlrPreview.tournaments.length)}
      subValue="Tournament names"
      appStyles={appStyles}
    />

    <StatCard
      label="Patterns"
      value={String(bowlrPreview.patterns.length)}
      subValue="Oil patterns found"
      appStyles={appStyles}
    />
  </div>
) : null}
{bowlrPreview ? (
  <div>
    <button
      type="button"
      onClick={importBowlrGames}
      style={{
        ...buttonStyle,
        background: appStyles.success,
        color: "#052e16",
        width: "100%",
        marginTop: 16,
      }}
    >
      Import {bowlrPreview.games} Bowlr Games
    </button>

    <button
      type="button"
      onClick={deleteImportedBowlrGames}
      style={{
        ...buttonStyle,
        background: appStyles.danger,
        color: "#fff",
        width: "100%",
        marginTop: 10,
      }}
    >
      Delete Previous Bowlr Import
    </button>
  </div>
) : null}
</div>

<SessionIntelModal
  selectedSessionIntel={selectedSessionIntel}
  setSelectedSessionIntel={setSelectedSessionIntel}
  appStyles={appStyles}
  buttonStyle={buttonStyle}
/>

<ToastMessage toast={toast} />

{renderFab()}

  </div>
);
}