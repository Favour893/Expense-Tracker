import "./globals.css";
import { AuthProvider } from "../src/components/auth/AuthProvider";
import { NotificationProvider } from "../src/components/notifications/NotificationProvider";

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

