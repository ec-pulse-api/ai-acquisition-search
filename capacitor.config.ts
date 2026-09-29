import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aiacquisition.search",
  appName: "AI Acquisition Search",
  webDir: "public",
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "https://ai-acquisition-search.vercel.app",
    cleartext: false,
  },
};

export default config;
