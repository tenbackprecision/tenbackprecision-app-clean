import React, { useState } from "react";


const pinRows = [
  [7, 8, 9, 10],
  [4, 5, 6],
  [2, 3],
  [1],
];

const leaveNames = {
  "7-10": "7-10 Split",
  "4-6-7-10": "Big Four",
  "2-4-5-8": "Bucket",
  "3-5-6-9": "Righty Bucket",
  "2-8": "Double Wood",
  "3-9": "Double Wood",
  "2-4-8-10": "Greek Church",
};

function getLeaveName(pins = []) {
  const key = [...pins].sort((a, b) => a - b).join("-");
  return leaveNames[key] || key || "No pins selected";
}

export default function PinLayoutSelector({
  value = [],
  onChange,
  appStyles,
  buttonStyle,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedPins = Array.isArray(value) ? value : [];

  function togglePin(pin) {
    const nextPins = selectedPins.includes(pin)
      ? selectedPins.filter((item) => item !== pin)
      : [...selectedPins, pin].sort((a, b) => a - b);

    onChange(nextPins);
  }

  function clearPins() {
    onChange([]);
  }

  const summary = getLeaveName(selectedPins);

  return (
    <div
      style={{
        gridColumn: "1 / -1",
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${appStyles.cardBorder}`,
        borderRadius: 18,
        padding: 16,
        boxShadow: appStyles.glowBlue,
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
          <div style={{ fontWeight: 900, fontSize: 18 }}>🎳 Pin Layout</div>
          <div style={{ color: appStyles.muted, marginTop: 4 }}>
            {summary}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          style={{
            ...buttonStyle,
            background: isOpen ? appStyles.accent : "rgba(255,255,255,0.12)",
            color: isOpen ? "#06203a" : appStyles.text,
          }}
        >
          {isOpen ? "Done" : "Edit Pins"}
        </button>
      </div>

      {isOpen ? (
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: "grid",
              gap: 10,
              justifyItems: "center",
            }}
          >
            {pinRows.map((row) => (
              <div
                key={row.join("-")}
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                }}
              >
                {row.map((pin) => {
                  const selected = selectedPins.includes(pin);

                  return (
                    <button
                      key={pin}
                      type="button"
                      onClick={() => togglePin(pin)}
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: "50%",
                        border: selected
                          ? `2px solid ${appStyles.accent}`
                          : `1px solid ${appStyles.cardBorder}`,
                        background: selected
                          ? appStyles.accent
                          : "rgba(255,255,255,0.08)",
                        color: selected ? "#06203a" : appStyles.text,
                        fontWeight: 900,
                        cursor: "pointer",
                        boxShadow: selected ? appStyles.glowBlue : "none",
                      }}
                    >
                      {pin}
                    </button>
                  );
                })}
              </div>
            ))}
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
              onClick={clearPins}
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