"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const trainerItems = [
  ["/trainer", "Dashboard", "⌂"],
  ["/trainer/trainingstag", "Trainingstage", "◫"],
  ["/trainer/spieler", "Spieler", "◎"],
  ["/trainer/boards", "Boards", "⊕"],
  ["/trainer/uebungen", "Übungskatalog", "✕"],
  ["/trainer/trainingsplaene", "Trainingspläne", "▣"],
  ["/trainer/heimtraining", "Heimtraining", "⌂"],
  ["/trainer/live", "Live Center", "●"],
] as const;

const playerItems = [
  ["/", "Dashboard", "⌂"],
  ["/training", "Mein Training", "🎯"],
  ["/heimtraining", "Heimtraining", "⌂"],
  ["/statistik", "Meine Statistik", "▥"],
] as const;

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;

  const trainerMode = pathname.startsWith("/trainer");
  const items = trainerMode ? trainerItems : playerItems;
  const homeHref = trainerMode ? "/trainer" : "/";

  return (
    <div className={`club-app ${trainerMode ? "trainer-mode" : "player-mode"}`}>
      <aside className="club-sidebar">
        <Link href={homeHref} className="club-brand">
          <span className="club-logo-mark"><i /><i /><i /></span>
          <span><strong>Vestischer</strong><b>Dart Club e.V.</b></span>
        </Link>

        <div className="club-role">{trainerMode ? "Trainerbereich" : "Spielerbereich"}</div>

        <nav className="club-nav">
          {items.map(([href, label, icon]) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} className={active ? "is-active" : ""}><span>{icon}</span><b>{label}</b>{label === "Live Center" && <i className="nav-live" />}</Link>;
          })}
        </nav>

        <div className="club-quick-card">
          <small>{trainerMode ? "Schnellzugriff" : "Nächstes Training"}</small>
          <strong>{trainerMode ? "Training verwalten" : "Vereinstraining"}</strong>
          <p>{trainerMode ? "Pläne, Boards und Spieler organisieren." : "Aktuelle Daten werden direkt aus der Datenbank geladen."}</p>
          <Link href={trainerMode ? "/trainer/trainingstag" : "/training"}>{trainerMode ? "Verwalten" : "Zum Training"}</Link>
        </div>

        <div className="club-profile">
          <span>{trainerMode ? "TR" : "SP"}</span>
          <div><small>{trainerMode ? "Trainer" : "Spieler"}</small><strong>{trainerMode ? "VDC Trainer" : "VDC Mitglied"}</strong></div>
          <Link href="/login">›</Link>
        </div>
      </aside>

      <section className="club-stage">
        <header className="club-topbar">
          <div><small>{trainerMode ? "Trainer Dashboard" : "Vestischer Dart Club"}</small><strong>{trainerMode ? "Alles im Blick. Alles unter Kontrolle." : "Training. Präzision. Fortschritt."}</strong></div>
          <div className="club-system"><span /> Datenbank verbunden</div>
        </header>
        <div className="club-content">{children}</div>
      </section>

      <nav className="club-mobile-nav">
        {items.slice(0, 5).map(([href, label, icon]) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return <Link key={href} href={href} className={active ? "is-active" : ""}><span>{icon}</span><small>{label.replace("Mein ", "")}</small></Link>;
        })}
      </nav>
    </div>
  );
}
