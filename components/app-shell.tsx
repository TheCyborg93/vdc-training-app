"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type IconName = "dashboard" | "calendar" | "plans" | "home" | "exercises" | "players" | "boards" | "live" | "archive" | "stats" | "system" | "login" | "switch";
type NavItem = { href: string; label: string; icon: IconName };
type NavGroup = { label: string; items: NavItem[] };

const trainerGroups: NavGroup[] = [
  { label: "Übersicht", items: [{ href: "/trainer", label: "Dashboard", icon: "dashboard" }] },
  { label: "Training", items: [
    { href: "/trainer/trainingstag", label: "Trainingstag", icon: "calendar" },
    { href: "/trainer/trainingsplaene", label: "Trainingspläne", icon: "plans" },
    { href: "/trainer/heimtraining", label: "Heimtraining", icon: "home" },
    { href: "/trainer/uebungen", label: "Übungskatalog", icon: "exercises" },
    { href: "/trainer/live", label: "Live Center", icon: "live" },
  ] },
  { label: "Verein", items: [
    { href: "/trainer/spieler", label: "Spieler", icon: "players" },
    { href: "/trainer/boards", label: "Boards", icon: "boards" },
  ] },
  { label: "Analyse", items: [{ href: "/trainer/archiv", label: "Archiv & Statistiken", icon: "archive" }] },
  { label: "System", items: [{ href: "/trainer/system", label: "Systeminformationen", icon: "system" }] },
];

const playerGroups: NavGroup[] = [
  { label: "Übersicht", items: [{ href: "/", label: "Dashboard", icon: "dashboard" }] },
  { label: "Training", items: [
    { href: "/training", label: "Trainingstag", icon: "calendar" },
    { href: "/heimtraining", label: "Heimtraining", icon: "home" },
  ] },
  { label: "Analyse", items: [{ href: "/statistik", label: "Statistik", icon: "stats" }] },
];

const pageNames: Record<string, string> = {
  "/": "Dashboard",
  "/training": "Trainingstag",
  "/heimtraining": "Heimtraining",
  "/statistik": "Statistik",
  "/trainer": "Trainer-Dashboard",
  "/trainer/trainingstag": "Trainingstag",
  "/trainer/trainingsplaene": "Trainingspläne",
  "/trainer/heimtraining": "Heimtraining erstellen",
  "/trainer/uebungen": "Übungskatalog",
  "/trainer/live": "Live Center",
  "/trainer/spieler": "Spieler",
  "/trainer/boards": "Boards",
  "/trainer/archiv": "Archiv & Statistiken",
  "/trainer/system": "Systeminformationen",
};

type TrainerSession = { authenticated: boolean; trainer: { name: string; role: "TRAINER" | "ADMIN" } | null };
type HealthState = "checking" | "online" | "offline";

function Icon({ name }: { name: IconName }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
    plans: <><path d="M8 4h11v16H5V7z"/><path d="M8 4v3H5M9 11h6M9 15h6"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    exercises: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m15 9 5-5"/></>,
    players: <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-7 6-7s6 3 6 7"/><circle cx="17" cy="9" r="2"/><path d="M16 14c3 0 5 2 5 6"/></>,
    boards: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v18M3 12h18"/></>,
    live: <><circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/></>,
    archive: <><path d="M4 7h16v13H4zM3 3h18v4H3z"/><path d="M9 11h6"/></>,
    stats: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    system: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2v-4h.09A1.7 1.7 0 0 0 3.6 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8 3.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4v.09A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8c.15.38.36.72.6 1 .3.35.7.55 1.1.6h.09v4h-.09c-.4.05-.8.25-1.1.6-.24.28-.45.62-.6 1Z"/></>,
    login: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h7v18h-7"/></>,
    switch: <><path d="M7 7h11l-3-3M17 17H6l3 3"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<TrainerSession>({ authenticated: false, trainer: null });
  const [health, setHealth] = useState<HealthState>("checking");
  const [latency, setLatency] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const trainerMode = pathname.startsWith("/trainer");
  const focusMode = pathname === "/training" || pathname === "/heimtraining";
  const groups = trainerMode ? trainerGroups : playerGroups;
  const pageTitle = pageNames[pathname] ?? pageNames[Object.keys(pageNames).filter((key) => key !== "/" && pathname.startsWith(`${key}/`)).sort((a, b) => b.length - a.length)[0]] ?? "VDC Training OS";

  useEffect(() => {
    if (pathname === "/login") return;
    const controller = new AbortController();
    void fetch("/api/auth/me", { cache: "no-store", signal: controller.signal }).then((response) => response.json()).then((data: TrainerSession) => setSession(data)).catch(() => setSession({ authenticated: false, trainer: null }));
    return () => controller.abort();
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/login") return;
    let disposed = false;
    const checkHealth = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const data = await response.json();
        if (!disposed) { setHealth(response.ok && data.ok ? "online" : "offline"); setLatency(Number.isFinite(data.latencyMs) ? data.latencyMs : null); }
      } catch { if (!disposed) setHealth("offline"); }
    };
    void checkHealth();
    const timer = window.setInterval(() => void checkHealth(), 60000);
    document.addEventListener("visibilitychange", checkHealth);
    return () => { disposed = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", checkHealth); };
  }, [pathname]);

  const profileLabel = useMemo(() => session.authenticated && session.trainer ? session.trainer.name : trainerMode ? "Trainer" : "VDC Mitglied", [session, trainerMode]);
  const dateLabel = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setSession({ authenticated: false, trainer: null });
    router.push("/");
    router.refresh();
  }

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className={`vdc-app ${trainerMode ? "is-trainer" : "is-player"} ${focusMode ? "is-focus-route" : ""} ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="vdc-sidebar">
        <div className="vdc-sidebar-head">
          <Link href={trainerMode ? "/trainer" : "/"} className="vdc-brand" aria-label="Vestischer Dart Club Startseite">
            <span className="vdc-brand-mark" aria-hidden="true"><i/><i/><i/></span>
            <span className="vdc-brand-copy"><strong>Vestischer</strong><b>Dart Club e.V.</b><small>Training OS</small></span>
          </Link>
          <button className="vdc-collapse" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Navigation ausklappen" : "Navigation einklappen"}>‹</button>
        </div>
        <div className="vdc-role-badge"><span/>{trainerMode ? "Trainerzentrale" : "Spielerbereich"}</div>
        <nav className="vdc-nav" aria-label={trainerMode ? "Trainernavigation" : "Spielernavigation"}>
          {groups.map((group) => <div className="vdc-nav-group" key={group.label}><small>{group.label}</small>{group.items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <Link key={item.href} href={item.href} className={active ? "is-active" : ""} title={collapsed ? item.label : undefined}><span className="vdc-nav-icon"><Icon name={item.icon}/>{item.icon === "live" && <i className="vdc-live-dot"/>}</span><b>{item.label}</b></Link>;
          })}</div>)}
        </nav>
        <div className="vdc-sidebar-bottom">
          {trainerMode ? <Link href="/" className="vdc-area-switch"><Icon name="switch"/><span><small>Bereich wechseln</small><strong>Zur Spielerseite</strong></span></Link> : session.authenticated ? <Link href="/trainer" className="vdc-area-switch is-authorized"><Icon name="switch"/><span><small>{session.trainer?.role === "ADMIN" ? "Administrator" : "Trainer"}</small><strong>Trainerbereich</strong></span></Link> : <Link href="/login" className="vdc-area-switch"><Icon name="login"/><span><small>Geschützter Bereich</small><strong>Trainer-Login</strong></span></Link>}
          <div className="vdc-profile"><span className="vdc-avatar">{profileLabel.slice(0, 2).toUpperCase()}</span><div><small>{session.authenticated ? session.trainer?.role : trainerMode ? "Trainer" : "Spieler"}</small><strong>{profileLabel}</strong></div>{session.authenticated ? <button type="button" onClick={() => void logout()} aria-label="Abmelden">×</button> : null}</div>
        </div>
      </aside>
      <section className="vdc-stage"><header className="vdc-topbar"><div className="vdc-page-context"><small>{trainerMode ? "Trainerbereich" : "Spielerbereich"} <span>/</span> {pageTitle}</small><strong>{pageTitle}</strong></div><div className="vdc-topbar-meta"><span className="vdc-date">{dateLabel}</span><span className={`vdc-health is-${health}`} title={latency !== null ? `Datenbankantwort: ${latency} ms` : "Systemstatus"}><i/>{health === "checking" ? "Prüfung" : health === "online" ? `Online${latency !== null ? ` · ${latency} ms` : ""}` : "Offline"}</span><span className="vdc-top-profile"><b>{profileLabel}</b><small>{session.authenticated ? session.trainer?.role : trainerMode ? "Trainer" : "Spieler"}</small></span></div></header><div className="vdc-content">{children}</div></section>
      <nav className="vdc-mobile-nav" aria-label="Mobile Navigation">{groups.flatMap((group) => group.items).slice(0, 4).map((item) => { const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} className={active ? "is-active" : ""}><Icon name={item.icon}/><small>{item.label}</small></Link>; })}{trainerMode ? <Link href="/"><Icon name="switch"/><small>Spieler</small></Link> : session.authenticated ? <Link href="/trainer"><Icon name="switch"/><small>Trainer</small></Link> : <Link href="/login"><Icon name="login"/><small>Login</small></Link>}</nav>
    </div>
  );
}
