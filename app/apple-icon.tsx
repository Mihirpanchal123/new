import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

function Tile({ bg, fg, letter, rotate }: { bg: string; fg: string; letter: string; rotate: number }) {
  return (
    <div
      style={{
        width: 74,
        height: 84,
        borderRadius: 20,
        background: bg,
        color: fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 52,
        fontWeight: 800,
        transform: `rotate(${rotate}deg)`,
        margin: "0 -6px",
      }}
    >
      {letter}
    </div>
  );
}

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0c16" }}>
        <Tile bg="#8669ff" fg="#fff" letter="W" rotate={-12} />
        <Tile bg="#ffc247" fg="#2a1a00" letter="D" rotate={12} />
      </div>
    ),
    size,
  );
}
