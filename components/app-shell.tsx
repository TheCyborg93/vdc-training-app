"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const items = [
  { href: "/trainer", label: "Dashboard", icon: "M4 4h6v6H4zM14 4h6v10h-6zM4 14h6v6H4zM14 18h6v2h-6z" },
  { href: "/training", label: "Training", icon: "M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" },
  { href: "/trainer/trainingstag", label: "Trainingstag", icon: "M5 4h14v16H5zM8 2v4M16 2v4M5 9h14" },
  { href: "/trainer/heimtraining", label: "Heimtraining", icon: "M3 11 12 4l9 7v9h-6v-6H9v6H3z" },
  { href: "/trainer/trainingsplaene", label: "Trainingspläne", icon: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4" },
  { href: "/trainer/uebungen", label: "Übungen", icon: "M4 12h4l2-5 4 10 2-5h4" },
  { href: "/trainer/spieler", label: "Spieler", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 3.6-7 8-7s8 3 8 7" },
  { href: "/trainer/boards", label: "Boards", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" },
  { href: "/statistik", label: "Statistiken", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/trainer/live", label: "Live", icon: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" },
];

function NavIcon({ path }: { path: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d={path} /></svg>;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname === "/login";

  if (isAuth) return <>{children}</>;

  return (
    <div className="steel-app">
      <aside className="steel-sidebar">
        <Link href="/trainer" className="steel-brand" aria-label="VDC Training Dashboard">
          <span className="steel-brand-target"><i /><i /><i /></span>
          <span><strong>VDC Training</strong><small>Steel & Precision</small></span>
        </Link>

        <div className="steel-sidebar-label">Trainingszentrale</div>
        <nav className="steel-nav" aria-label="App-Navigation">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== "/trainer" && pathname.startsWith(`${item.href}/`));
            return (
              <Link className={active ? "is-active" : ""} href={item.href} key={item.href}>
                <NavIcon path={item.icon} />
                <span>{item.label}</span>
                {item.label === "Live" && <b className="live-dot" />}
              </Link>
            );
          })}
        </nav>

        <div className="steel-profile">
          <span className="steel-avatar">VT</span>
          <span><small>Angemeldet als</small><strong>VDC Trainer</strong></span>
          <Link href="/login" aria-label="Anmeldung öffnen">↗</Link>
        </div>
      </aside>

      <section className="steel-stage">
        <header className="steel-topbar">
          <div><span className="topbar-kicker">Vestischer Dartclub</span><strong>Digitale Trainingsplattform</strong></div>
          <div className="topbar-status"><span /><small>System online</small></div>
        </header>
        <div className="steel-content">{children}</div>
      </section>

      <nav className="steel-mobile-nav" aria-label="Mobile Navigation">
        {items.slice(0, 5).map((item) => {
          const active = pathname === item.href || (item.href !== "/trainer" && pathname.startsWith(`${item.href}/`));
          return <Link className={active ? "is-active" : ""} href={item.href} key={item.href}><NavIcon path={item.icon} /><span>{item.label}</span></Link>;
        })}
      </nav>
    </div>
  );
}
