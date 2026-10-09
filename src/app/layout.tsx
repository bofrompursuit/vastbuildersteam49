import type { Metadata, Viewport } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Figtree({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AURAAFIT",
  description: "Retail & Foot-Traffic Intelligence Engine",
  manifest: "/manifest.webmanifest?v=4",
  icons: {
    icon: [
      { url: "/favicon.ico?v=3", sizes: "16x16 32x32 48x48" },
      { url: "/aurafit-icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/aurafit-square-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/aurafit-apple-180.png", sizes: "180x180" },
      { url: "/apple-touch-icon-precomposed.png?v=2", sizes: "180x180", rel: "apple-touch-icon-precomposed" },
    ],
  },
  appleWebApp: { capable: true, title: "AURAAFIT", statusBarStyle: "default" },
  // older iOS (< 17) only goes full-screen from the home screen with this legacy tag
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#1b6b93",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
