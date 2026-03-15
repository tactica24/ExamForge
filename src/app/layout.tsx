import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { InstallAppPrompt } from "@/components/install-app-prompt";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { getAppOrigin } from "@/lib/app-url";

const bodyFont = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700", "800"]
});

const headingFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: {
    default: "ACE NAIJA",
    template: "%s | ACE NAIJA"
  },
  description: "AI-powered exam prep PWA for WAEC, JAMB, IELTS, ACCA, and ICAN.",
  applicationName: "ACE NAIJA",
  metadataBase: getAppOrigin(),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" }
    ],
    shortcut: "/favicon.ico",
    apple: "/icon-192.png"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d4a6a" },
    { media: "(prefers-color-scheme: dark)", color: "#08314a" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${headingFont.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors closeButton />
          <InstallAppPrompt />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
