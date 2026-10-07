import { ImageResponse } from "next/og";

export const alt = "Word Duel — Think alike. Guess faster.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Tile({ letter, bg, fg, rotate }: { letter: string; bg: string; fg: string; rotate: number }) {
  return (
    <div
      style={{
        width: 110,
        height: 120,
        borderRadius: 26,
        background: bg,
        color: fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 76,
        fontWeight: 800,
        transform: `rotate(${rotate}deg)`,
        margin: "0 8px",
      }}
    >
      {letter}
    </div>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 0%, #2a2160 0%, #0c0c16 70%)",
          color: "#f3f2fb",
        }}
      >
        <div style={{ display: "flex" }}>
          {["W", "O", "R", "D"].map((l, i) => (
            <Tile key={i} letter={l} bg="#8669ff" fg="#fff" rotate={(i - 1.5) * 3} />
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 18 }}>
          {["D", "U", "E", "L"].map((l, i) => (
            <Tile key={i} letter={l} bg="#ffc247" fg="#2a1a00" rotate={(1.5 - i) * 3} />
          ))}
        </div>
        <div style={{ marginTop: 44, fontSize: 44, fontWeight: 700 }}>Think alike. Guess faster.</div>
      </div>
    ),
    size,
  );
}
