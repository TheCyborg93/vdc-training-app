import type { Metadata } from "next";
import AppShell from "@/components/app-shell";
import "./globals.css";
import "./steel-ui.css";
import "./club-ui.css";
import "./login-nav.css";
import "./vdc-premium.css";

export const metadata: Metadata = {
  title: "VDC Training",
  description: "Digitale Trainingsplattform des Vestischen Dartclubs",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
