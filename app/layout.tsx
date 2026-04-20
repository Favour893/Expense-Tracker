import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "../src/components/auth/AuthProvider";
import { NotificationProvider } from "../src/components/notifications/NotificationProvider";

export const metadata: Metadata = {
  applicationName: "Monthly Money Reports",
  appleWebApp: {
    capable: true,
    title: "Monthly Money Reports",
    statusBarStyle: "default"
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#4F46E5",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NotificationProvider>
          <AuthProvider>{children}</AuthProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}

