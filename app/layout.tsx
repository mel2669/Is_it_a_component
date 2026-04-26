import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Variant or New Component",
  description: "A focused tool for design system intake triage."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-white text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
