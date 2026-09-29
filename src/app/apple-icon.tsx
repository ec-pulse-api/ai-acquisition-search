import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: size * 0.22, background: "linear-gradient(135deg, #071d63 0%, #0042c8 52%, #10d8c0 100%)", overflow: "hidden" }}>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size * 0.82, height: size * 0.62, position: "relative" }}>
    <div style={{ color: "white", fontSize: size * 0.22, fontWeight: 800, fontFamily: "Arial, sans-serif", letterSpacing: "-0.08em", lineHeight: 1 }}>EC</div>
    <svg width={size * 0.38} height={size * 0.30} viewBox="0 0 100 76" style={{ position: "absolute", right: 0, top: size * 0.14 }}>
      <path d="M8 47 C18 49 25 51 34 50 L49 22 L61 60 L72 44 L94 44" fill="none" stroke="#11e5dc" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
</div>, size);
}
