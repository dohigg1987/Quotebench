import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuoteBench",
  description: "Governed pricing and quoting for service and product businesses.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body className="antialiased">{children}</body>
    </html>
  );
}
