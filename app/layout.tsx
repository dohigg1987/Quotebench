import type { Metadata } from "next";
import "./globals.css";
import "./design-system.css";
import "./horizon-premium.css";
import "./commercial-grade.css";

export const metadata: Metadata = {
  title: "QuoteBench",
  description: "Governed pricing and quoting for service and product businesses.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
