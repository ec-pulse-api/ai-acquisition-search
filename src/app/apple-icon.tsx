const ICON_SIZE = 180;

export const size = { width: ICON_SIZE, height: ICON_SIZE };
export const contentType = "image/svg+xml";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#071d63"/><stop offset=".52" stop-color="#0042c8"/><stop offset="1" stop-color="#10d8c0"/></linearGradient></defs>
<rect width="180" height="180" rx="40" fill="url(#g)"/>
<text x="28" y="108" fill="#fff" font-family="Arial,sans-serif" font-size="40" font-weight="800">EC</text>
<path d="M106 99 C116 102 122 104 129 103 L140 76 L149 112 L157 94 L168 94" fill="none" stroke="#11e5dc" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export default function AppleIcon() {
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } });
}
