import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { ChrystyLiveEmbedProvider } from "@chrysty/live-embed";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chrysty — Your personal stylist",
  description: "Show me what you wear. I'll handle the rest.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
  other: {
    google: "notranslate",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F4" },
    { media: "(prefers-color-scheme: dark)", color: "#1E1A18" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <body
        className={`notranslate ${dmSans.variable} ${fraunces.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <ChrystyLiveEmbedProvider
            worker="stylist"
            astraEmbedUrl={
              process.env.NEXT_PUBLIC_ASTRA_EMBED_URL ??
              "https://chrysty.chrysty.dev"
            }
          >
            {children}
          </ChrystyLiveEmbedProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
