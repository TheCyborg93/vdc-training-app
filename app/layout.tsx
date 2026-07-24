import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "VDC Training",
  description: "Digitale Trainingsplattform des Vestischen Dartclubs"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <div className="app-shell">
          <header className="site-header">
            <Link href="/" className="brand" aria-label="VDC Training Startseite">
              <span className="brand-mark">V</span>
              <span className="brand-copy">
                <strong>VDC Training</strong>
                <small>Vestischer Dartclub</small>
              </span>
            </Link>

            <nav className="site-nav" aria-label="Hauptnavigation">
              <Link href="/trainingstag">Trainingstag</Link>
              <Link href="/trainer">Trainerbereich</Link>
              <Link className="nav-login" href="/login">Anmelden</Link>
            </nav>
          </header>

          {children}

          <footer className="site-footer">
            <span>VDC Training</span>
            <span>Digitale Trainingsplattform</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
