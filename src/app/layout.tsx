import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Acquisition Search",
  description: "Find businesses worth acquiring with AI-powered acquisition intelligence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
