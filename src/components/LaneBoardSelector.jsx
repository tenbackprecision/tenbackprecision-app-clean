import React, { useState } from "react";

const BOARD_COUNT = 40;
const LANE_LEFT = 50;
const LANE_RIGHT = 370;
const LANE_TOP = 30;
const LANE_BOTTOM = 520;
const LANE_WIDTH = LANE_RIGHT - LANE_LEFT;
const BOARD_WIDTH = LANE_WIDTH / BOARD_COUNT;

function getBoardX(board) {
  return LANE_LEFT + (Number(board) - 0.5) * BOARD_WIDTH;
}

export default function LaneBoardSelector({
  value = {},
  onChange,
  pinLayout = [],
  onPinLayoutChange,
  appStyles,
  buttonStyle,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selecting, setSelecting] = useState("feet");
  const [hoveredBoard, setHoveredBoard] = useState(null);

  const layout = {
    feet: value.feet || "",
    target: value.target || "",
    breakpoint: value.breakpoint || "",
  };

const pinSummary =
  pinLayout.length > 0 ? pinLayout.join("-") : "None";

const selectingLabel =
  selecting === "feet"
    ? "👣 Click the lane to set your feet position."
    : selecting === "target"
      ? "🎯 Click the lane to set your target board."
      : "⭐ Click the lane to set your breakpoint.";

  function setBoard(board) {
    onChange({
      ...layout,
      [selecting]: board,
    });
  }

  function clearLayout() {
    onChange({
      feet: "",
      target: "",
      breakpoint: "",
    });
  }

function togglePin(pin) {
  const selectedPins = Array.isArray(pinLayout) ? pinLayout : [];

  const nextPins = selectedPins.includes(pin)
    ? selectedPins.filter((item) => item !== pin)
    : [...selectedPins, pin].sort((a, b) => a - b);

  onPinLayoutChange(nextPins);
}

  return (
    <div
      style={{
        gridColumn: "1 / -1",
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${appStyles.cardBorder}`,
        borderRadius: 18,
        padding: 16,
        boxShadow: appStyles.glowPurple,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>🎯 Lane Play</div>
          <div style={{ color: appStyles.muted, marginTop: 4 }}>
            Feet {layout.feet || "-"} · Target {layout.target || "-"} ·
            Breakpoint {layout.breakpoint || "-"}
<div
  style={{
    color: appStyles.muted,
    marginTop: 2,
    fontSize: 13,
  }}
>
  Pins: {pinSummary}
</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          style={{
            ...buttonStyle,
            background: isOpen ? appStyles.accent2 : "rgba(255,255,255,0.12)",
            color: "#fff",
          }}
        >
          {isOpen ? "Done" : "Edit Lane"}
        </button>
      </div>

      {isOpen ? (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            {["feet", "target", "breakpoint"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSelecting(mode)}
                style={{
                  ...buttonStyle,
                  padding: "8px 12px",
                  fontSize: 13,
                  background:
                    selecting === mode
                      ? appStyles.accent
                      : "rgba(255,255,255,0.12)",
                  color: selecting === mode ? "#06203a" : appStyles.text,
                }}
              >
                {mode === "feet"
                  ? "👣 Feet"
                  : mode === "target"
                    ? "🎯 Target"
                    : "⭐ Breakpoint"}
              </button>
            ))}
          </div>

<div
  style={{
    textAlign: "center",
    color: appStyles.muted,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 12,
  }}
>
  {selectingLabel}
</div>

          <div
            style={{
              border: `1px solid ${appStyles.cardBorder}`,
              borderRadius: 18,
              overflow: "hidden",
              background: "rgba(15, 23, 42, 0.95)",
            }}
          >
            <svg viewBox="0 0 420 560" width="100%" height="auto">
              <defs>
                <linearGradient id="laneWood" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#c98b3c" />
                  <stop offset="35%" stopColor="#f0c56f" />
                  <stop offset="65%" stopColor="#e2a94f" />
                  <stop offset="100%" stopColor="#b8732f" />
                </linearGradient>

                <linearGradient id="gutterDark" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#111827" />
                  <stop offset="100%" stopColor="#020617" />
                </linearGradient>

                <filter id="softGlow">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <rect x="0" y="0" width="420" height="560" fill="#020617" />

              <rect
                x="20"
                y={LANE_TOP}
                width="25"
                height={LANE_BOTTOM - LANE_TOP}
                rx="14"
                fill="url(#gutterDark)"
              />
              <rect
                x="375"
                y={LANE_TOP}
                width="25"
                height={LANE_BOTTOM - LANE_TOP}
                rx="14"
                fill="url(#gutterDark)"
              />

              <rect
                x={LANE_LEFT}
                y={LANE_TOP}
                width={LANE_WIDTH}
                height={LANE_BOTTOM - LANE_TOP}
                rx="16"
                fill="url(#laneWood)"
              />

              {Array.from({ length: BOARD_COUNT }, (_, index) => {
                const board = index + 1;
                const x = LANE_LEFT + index * BOARD_WIDTH;

                return (
                  <g key={board}>
                    <rect
                      x={x}
                      y={LANE_TOP}
                      width={BOARD_WIDTH}
                      height={LANE_BOTTOM - LANE_TOP}
                      fill={
                        board % 2 === 0
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(0,0,0,0.04)"
                      }
                    />
                    <line
                      x1={x}
                      y1={LANE_TOP}
                      x2={x}
                      y2={LANE_BOTTOM}
                      stroke="rgba(55,35,12,0.22)"
                      strokeWidth="0.6"
                    />
                  </g>
                );
              })}

              <line
                x1={LANE_LEFT}
                y1="500"
                x2={LANE_RIGHT}
                y2="500"
                stroke="rgba(255,255,255,0.75)"
                strokeWidth="3"
              />
              <text
                x="210"
                y="493"
                textAnchor="middle"
                fill="rgba(255,255,255,0.85)"
                fontSize="10"
                fontWeight="800"
              >
                FOUL LINE
              </text>

              <g>
  {[
    { pin: 7, x: 150, y: 75 },
    { pin: 8, x: 190, y: 75 },
    { pin: 9, x: 230, y: 75 },
    { pin: 10, x: 270, y: 75 },

    { pin: 4, x: 170, y: 102 },
    { pin: 5, x: 210, y: 102 },
    { pin: 6, x: 250, y: 102 },

    { pin: 2, x: 190, y: 129 },
    { pin: 3, x: 230, y: 129 },

    { pin: 1, x: 210, y: 156 },
  ].map(({ pin, x, y }) => {
  const isSelected = pinLayout.includes(pin);

  return (
    <g
      key={pin}
      onClick={() => togglePin(pin)}
      style={{ cursor: "pointer" }}
    >
      <ellipse
        cx={x}
        cy={y}
        rx="10"
        ry="7"
        fill={isSelected ? appStyles.accent : "#f8fbff"}
        stroke={isSelected ? "#ffffff" : 	"rgba(15,23,42,0.7)"}
	strokeWidth={isSelected ? "2.5" : "1"}
      />

      <rect
        x={x - 6}
        y={y - 16}
        width="12"
        height="18"
        rx="5"
        fill={isSelected ? appStyles.accent : "#f8fbff"}
        stroke={isSelected ? "#ffffff" : 	"rgba(15,23,42,0.55)"}
	strokeWidth={isSelected ? "2.5" : "1"}
      />

      <rect
        x={x - 5}
        y={y - 9}
        width="10"
        height="4"
        rx="2"
        fill="#ef4444"
        opacity="0.9"
      />

      <text
        x={x}
        y={y + 3}
        textAnchor="middle"
        fill="#0f172a"
        fontSize="7"
        fontWeight="900"
      >
        {pin}
      </text>
    </g>
  );
})}
</g>

              {[5, 10, 15, 20, 25, 30, 35].map((board) => {
                const x = getBoardX(board);
                return (
                  <polygon
                    key={`arrow-${board}`}
                    points={`${x},205 ${x - 8},225 ${x + 8},225`}
                    fill="rgba(15,23,42,0.65)"
                    stroke="rgba(255,255,255,0.35)"
                  />
                );
              })}

              <text
                x="210"
                y="195"
                textAnchor="middle"
                fill="rgba(15,23,42,0.9)"
                fontSize="12"
                fontWeight="900"
              >
                ARROWS
              </text>

              {[10, 15, 20, 25, 30].map((board) => (
                <circle
                  key={`dot-near-${board}`}
                  cx={getBoardX(board)}
                  cy="417"
                  r="4"
                  fill="rgba(15,23,42,0.58)"
                />
              ))}

              {[10, 15, 20, 25, 30].map((board) => (
                <circle
                  key={`dot-far-${board}`}
                  cx={getBoardX(board)}
                  cy="295"
                  r="4"
                  fill="rgba(15,23,42,0.45)"
                />
              ))}

              {Array.from({ length: BOARD_COUNT }, (_, index) => {
                const board = index + 1;
                const x = getBoardX(board);

                return (
                  <g
  key={`click-${board}`}
  onClick={() => setBoard(board)}
  onMouseEnter={() => setHoveredBoard(board)}
  onMouseLeave={() => setHoveredBoard(null)}
  style={{ cursor: "pointer" }}
>
                    <>
  {hoveredBoard === board && (
    <rect
      x={x - BOARD_WIDTH / 2}
      y="75"
      width={BOARD_WIDTH}
      height="50"
      fill="rgba(56,189,248,0.22)"
      pointerEvents="none"
    />
  )}

  <rect
    x={x - BOARD_WIDTH / 2}
    y="125"
    width={BOARD_WIDTH}
    height={LANE_BOTTOM - 125}
    fill={
      hoveredBoard === board
        ? "rgba(56,189,248,0.22)"
        : "transparent"
    }
  />
</>

                    {[5, 10, 15, 20, 25, 30, 35, 40].includes(board) ? (
                      <text
                        x={x}
                        y="545"
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.78)"
                        fontSize="10"
                        fontWeight="900"
                      >
                        {board}
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {layout.breakpoint ? (
                <text
                  x={getBoardX(layout.breakpoint)}
                  y="180"
                  textAnchor="middle"
                  fontSize="20"
                  filter="url(#softGlow)"
                >
                  ⭐
                </text>
              ) : null}

              {layout.target ? (
                <text
                  x={getBoardX(layout.target)}
                  y="245"
                  textAnchor="middle"
                  fontSize="22"
                  filter="url(#softGlow)"
                >
                  🎯
                </text>
              ) : null}

              {layout.feet ? (
                <text
                  x={getBoardX(layout.feet)}
                  y="475"
                  textAnchor="middle"
                  fontSize="23"
                  filter="url(#softGlow)"
                >
                  👣
                </text>
              ) : null}
            </svg>
          </div>

          <div
            style={{
              display: "flex",
		gap: 10,
		flexWrap: "wrap",
              justifyContent: "center",
              marginTop: 14,
            }}
          >
            <button
              type="button"
              onClick={clearLayout}
              style={{
                ...buttonStyle,
                background: "rgba(255,255,255,0.12)",
                color: appStyles.text,
              }}
            >
              Clear Lane
            </button>
		<button
  		type="button"
  		onClick={() => onPinLayoutChange([])}
  		style={{
    ...buttonStyle,
    background: "rgba(255,255,255,0.12)",
    color: appStyles.text,
  }}
>
  Clear Pins
</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}