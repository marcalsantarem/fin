import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  return {
    metadataBase: base,
    title: "FIN",
    description: "FIN",
    applicationName: "FIN",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "FIN", statusBarStyle: "default" },
    openGraph: { title: "FIN", description: "FIN", images: [{ url: new URL("/og.png", base), width: 1792, height: 912, alt: "FIN" }] },
    twitter: { card: "summary_large_image", title: "FIN", description: "FIN", images: [new URL("/og.png", base)] },
  };
}

export const viewport: Viewport = {
  themeColor: "#132922",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
