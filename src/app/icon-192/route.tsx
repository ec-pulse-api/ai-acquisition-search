import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(<IconImage size={192} />, { width: 192, height: 192 });
}

function IconImage({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: size * 0.22, background: "linear-gradient(135deg, #071d63 0%, #0042c8 52%, #10d8c0 100%)", overflow: "hidden" }}>
      <svg width={size * 0.82} height={size * 0.62} viewBox="0 0 100 76">
        <text x="3" y="58" fill="white" fontSize="54" fontWeight="800" fontFamily="Arial, sans-serif">EC</text>
        <path d="M59 47 C65 49 68 51 72 50 L78 29 L83 58 L89 47 L97 47" fill="none" stroke="#11e5dc" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}
