import type { Metadata } from "next";
import AppShell from "@/components/app-shell";
import Providers from "./providers";
import "./globals.css";
import "./steel-ui.css";
import "./club-ui.css";
import "./login-nav.css";
import "./vdc-premium.css";
import "./training-report.css";
import "./vdc-responsive.css";
import "./training-result-grid.css";
import "./game121.css";
import "./training-archive.css";
import "./vdc-os.css";
import "./vdc-sprint2.css";
import "./competition-premium.css";
import "./vdc-sprint4.css";
import "./vdc-production.css";
import "./vdc-design-system.css";

export const metadata: Metadata = {
  title: "VDC Training OS",
  description: "Digitale Trainingsplattform des Vestischen Dart Club e.V.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <Providers><AppShell>{children}</AppShell></Providers>
      </body>
    </html>
  );
}
