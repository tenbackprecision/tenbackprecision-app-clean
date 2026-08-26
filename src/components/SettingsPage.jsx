export default function SettingsPage({
  appStyles,
  buttonStyle,
  inputStyle,
  pageTitleStyle,
  pageSubtitleStyle,
  defaultHouse,
  setDefaultHouse,
  defaultPrimaryBall,
  setDefaultPrimaryBall,
  defaultSecondaryBall,
  setDefaultSecondaryBall,
  defaultEventType,
  setDefaultEventType,
  defaultOilPattern,
  setDefaultOilPattern,
  equipmentOptions,
  performanceTypes,
  setActiveView,
  renderFab,
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
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={pageTitleStyle}>⚙️ Settings</div>
        <div style={pageSubtitleStyle}>
          Customize Ten Back Precision
        </div>
      </div>

      <div
        style={{
          maxWidth: 700,
          margin: "0 auto",
          background: appStyles.card,
          border: `1px solid ${appStyles.cardBorder}`,
          borderRadius: 24,
          padding: 24,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Coming Soon</h2>

        <p>✅ Theme Settings</p>
        <p>✅ Data Import / Export</p>
        <p>✅ Backup & Restore</p>

        <div style={{ marginTop: 18 }}>
          <div
            style={{
              fontWeight: 700,
              marginBottom: 8,
              color: appStyles.text,
            }}
          >
            🎳 Default Bowling Center
          </div>

          <input
            type="text"
            placeholder="Enter your home bowling center..."
            value={defaultHouse}
            onChange={(e) => {
              setDefaultHouse(e.target.value);
              localStorage.setItem(
                "tenBackDefaultHouse",
                e.target.value
              );
            }}
            style={inputStyle}
          />
        </div>

        <div style={{ marginTop: 18 }}>
          <div
            style={{
              fontWeight: 700,
              marginBottom: 8,
              color: appStyles.text,
            }}
          >
            🎳 Default Primary Ball
          </div>

          <select
            value={defaultPrimaryBall}
            onChange={(e) => {
              setDefaultPrimaryBall(e.target.value);
              localStorage.setItem(
                "tenBackDefaultPrimaryBall",
                e.target.value
              );
            }}
            style={inputStyle}
          >
            <option value="">Select a ball...</option>

            {equipmentOptions.map((ball) => (
              <option key={ball.id} value={ball.name}>
                {ball.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 18 }}>
          <div
            style={{
              fontWeight: 700,
              marginBottom: 8,
              color: appStyles.text,
            }}
          >
            🎳 Default Secondary Ball
          </div>

          <select
            value={defaultSecondaryBall}
            onChange={(e) => {
              setDefaultSecondaryBall(e.target.value);
              localStorage.setItem(
                "tenBackDefaultSecondaryBall",
                e.target.value
              );
            }}
            style={inputStyle}
          >
            <option value="">Select a ball...</option>

            {equipmentOptions.map((ball) => (
              <option key={ball.id} value={ball.name}>
                {ball.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 18 }}>
          <div
            style={{
              fontWeight: 700,
              marginBottom: 8,
              color: appStyles.text,
            }}
          >
            🏆 Default Event Type
          </div>

          <select
            value={defaultEventType}
            onChange={(e) => {
              setDefaultEventType(e.target.value);
              localStorage.setItem(
                "tenBackDefaultEventType",
                e.target.value
              );
            }}
            style={inputStyle}
          >
            {performanceTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 18 }}>
          <div
            style={{
              fontWeight: 700,
              marginBottom: 8,
              color: appStyles.text,
            }}
          >
            🛢️ Default Oil Pattern
          </div>

          <input
            type="text"
            value={defaultOilPattern}
            onChange={(e) => {
              setDefaultOilPattern(e.target.value);
              localStorage.setItem(
                "tenBackDefaultOilPattern",
                e.target.value
              );
            }}
            placeholder="House Shot, PBA Scorpion, etc."
            style={inputStyle}
          />
        </div>

        <p>✅ App Preferences</p>

        <button
          onClick={() => setActiveView("dashboard")}
          style={{
            ...buttonStyle,
            marginTop: 20,
            background: appStyles.accent,
            color: "#1a1633",
          }}
        >
          Return to Dashboard
        </button>
      </div>

      {renderFab()}
    </div>
  );
}