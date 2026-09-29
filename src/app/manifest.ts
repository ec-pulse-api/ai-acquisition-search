import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Acquisition Search",
    short_name: "AI Acquisition",
    description: "AI集客検索エンジン",
    start_url: "/",
    display: "standalone",
    background_color: "#071d63",
    theme_color: "#071d63",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
