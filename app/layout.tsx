import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "VDC Training",
  description: "Trainings-Webapp des Vestischen Dartclubs"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <div className="shell">
          <header className="header">
            <Link href="/" className="brand">VDC <span>Training</span></Link>
            <nav className="nav">
              <Link href="/trainingstag">Trainingstag</Link>
              <Link href="/trainer">Trainerbereich</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
