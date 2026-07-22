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
    description: "Organize sua vida financeira com clareza, segurança e simplicidade.",
    applicationName: "FIN",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "FIN", statusBarStyle: "default" },
    openGraph: { title: "FIN", description: "Organize sua vida financeira com clareza e uma interface que combina com você.", images: [{ url: new URL("/og-v3.png", base), width: 1536, height: 1024, alt: "FIN — três experiências visuais para suas finanças" }] },
    twitter: { card: "summary_large_image", title: "FIN", description: "Três temas completos para organizar sua vida financeira.", images: [new URL("/og-v3.png", base)] },
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
