import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

function metadataBaseUrl(): URL {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: "Variant or New Component",
  description: "A focused tool for design system intake triage.",
  openGraph: {
    title: "Is it component?",
    description:
      "A focused tool for the most common design system intake question. Get a variant vs. new component verdict in minutes.",
    siteName: "Is it component?",
    type: "website",
    locale: "en_US"
  },
  twitter: {
    card: "summary_large_image",
    title: "Is it component?",
    description:
      "A focused tool for the most common design system intake question. Get a variant vs. new component verdict in minutes."
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#07080a] text-[#f4f4f6] antialiased`}>
        {children}
      </body>
    </html>
  );
}
