import React, { useState } from "react";

const boards = Array.from({ length: 40 }, (_, index) => 40 - index);

export default function BoardLayoutSelector({
  value = {},
  onChange,
  appStyles,
  buttonStyle,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selecting, setSelecting] = useState("feet");

  const layout = {
    feet: value.feet || "",
    target: value.target || "",
    breakpoint: value.breakpoint || "",
  };

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

  const summary =
    layout.feet || layout.target || layout.breakpoint
      ? `Feet ${layout.feet || "-"} · Target ${layout.target || "-"} · Breakpoint ${
          layout.breakpoint || "-"
        }`
      : "No boards selected";

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
          <div style={{ fontWeight: 900, fontSize: 18 }}>🎯 Board Layout</div>
          <div style={{ color: appStyles.muted, marginTop: 4 }}>{summary}</div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          style={{
            ...buttonStyle,
            background: isOpen ? appStyles.accent2 : "rgba(255,255,255,0.12)",
            color: isOpen ? "#fff" : appStyles.text,
          }}
        >
          {isOpen ? "Done" : "Edit Boards"}
        </button>
      </div>

      {isOpen ? (
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 14,
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
                  ? "Feet"
                  : mode === "target"
                    ? "Target"
                    : "Breakpoint"}
              </button>
            ))}
          </div>

          <div
            style={{
              overflowX: "auto",
              paddingBottom: 8,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(40, minmax(36px, 1fr))",
                gap: 6,
                minWidth: 1500,
              }}
            >
              {boards.map((board) => {
                const isFeet = Number(layout.feet) === board;
                const isTarget = Number(layout.target) === board;
                const isBreakpoint = Number(layout.breakpoint) === board;

                const selected = isFeet || isTarget || isBreakpoint;

                return (
                  <button
                    key={board}
                    type="button"
                    onClick={() => setBoard(board)}
                    style={{
                      height: 48,
                      borderRadius: 10,
                      border: selected
                        ? `2px solid ${appStyles.accent}`
                        : `1px solid ${appStyles.cardBorder}`,
                      background: selected
                        ? "rgba(56,189,248,0.28)"
                        : "rgba(255,255,255,0.08)",
                      color: appStyles.text,
                      fontWeight: 900,
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    <div>{board}</div>
                    <div style={{ fontSize: 10, marginTop: 3 }}>
                      {isFeet ? "F" : ""}
                      {isTarget ? "T" : ""}
                      {isBreakpoint ? "B" : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: "flex",
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
              Clear Boards
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}