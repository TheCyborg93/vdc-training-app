"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const trainerItems = [
  ["/trainer", "Dashboard", "01"],
  ["/trainer/trainingstag", "Trainingstage", "02"],
  ["/trainer/spieler", "Spieler", "03"],
  ["/trainer/boards", "Boards", "04"],
  ["/trainer/uebungen", "Übungen", "05"],
  ["/trainer/trainingsplaene", "Pläne", "06"],
  ["/trainer/heimtraining", "Heimtraining", "07"],
  ["/trainer/live", "Live Center", "08"],
] as const;

const playerItems = [
  ["/", "Dashboard", "01"],
  ["/training", "Trainingstag", "02"],
  ["/heimtraining", "Heimtraining", "03"],
  ["/statistik", "Statistik", "04"],
] as const;

type TrainerSession = {
  authenticated: boolean;
  trainer: { name: string; role: "TRAINER" | "ADMIN" } | null;
};

type HealthState = "checking" | "online" | "offline";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<TrainerSession>({ authenticated: false, trainer: null });
  const [health, setHealth] = useState<HealthState>("checking");
  const [latency, setLatency] = useState<number | null>(null);

  const trainerMode = pathname.startsWith("/trainer");
  const focusMode = pathname === "/training" || pathname === "/heimtraining";
  const items = trainerMode ? trainerItems : playerItems;

  useEffect(() => {
    if (pathname === "/login") return;

    const controller = new AbortController();
    void fetch("/api/auth/me", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((data: TrainerSession) => setSession(data))
      .catch(() => setSession({ authenticated: false, trainer: null }));

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
        if (!disposed) {
          setHealth(response.ok && data.ok ? "online" : "offline");
          setLatency(Number.isFinite(data.latencyMs) ? data.latencyMs : null);
        }
      } catch {
        if (!disposed) setHealth("offline");
      }
    };

    void checkHealth();
    const timer = window.setInterval(() => void checkHealth(), 60000);
    const onVisibility = () => void checkHealth();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  const profileLabel = useMemo(() => {
    if (session.authenticated && session.trainer) return session.trainer.name;
    return trainerMode ? "Trainer" : "VDC Mitglied";
  }, [session, trainerMode]);

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setSession({ authenticated: false, trainer: null });
    router.push("/");
    router.refresh();
  }

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className={`club-app ${trainerMode ? "trainer-mode" : "player-mode"} ${focusMode ? "has-training-route" : ""}`}>
      <aside className="club-sidebar">
        <Link href={trainerMode ? "/trainer" : "/"} className="club-brand" aria-label="Vestischer Dart Club Startseite">
          <span className="club-logo-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>Vestischer</strong><b>Dart Club e.V.</b></span>
        </Link>

        <div className="club-role"><span />{trainerMode ? "Trainerzentrale" : "Spielerportal"}</div>

        <nav className="club-nav" aria-label={trainerMode ? "Trainernavigation" : "Spielernavigation"}>
          {items.map(([href, label, number]) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} className={active ? "is-active" : ""}>
                <span>{number}</span><b>{label}</b>{label === "Live Center" && <i className="nav-live" />}
              </Link>
            );
          })}
        </nav>

        <div className="club-area-switch">
          {trainerMode ? (
            <Link href="/" className="club-switch-link"><span>←</span><div><small>Ansicht wechseln</small><strong>Zur Spielerseite</strong></div></Link>
          ) : session.authenticated ? (
            <Link href="/trainer" className="club-switch-link is-authorized"><span>→</span><div><small>{session.trainer?.role === "ADMIN" ? "Administrator" : "Trainer"}</small><strong>Trainerbereich öffnen</strong></div></Link>
          ) : (
            <Link href="/login" className="club-switch-link"><span>→</span><div><small>Geschützter Bereich</small><strong>Trainer Login</strong></div></Link>
          )}
        </div>

        <div className="club-profile">
          <span>{profileLabel.slice(0, 2).toUpperCase()}</span>
          <div><small>{session.authenticated ? session.trainer?.role : trainerMode ? "Trainer" : "Spieler"}</small><strong>{profileLabel}</strong></div>
          {session.authenticated ? <button type="button" onClick={() => void logout()} title="Abmelden">×</button> : <Link href="/login">›</Link>}
        </div>
      </aside>

      <section className="club-stage">
        <header className="club-topbar">
          <div>
            <small>{trainerMode ? "VDC Training Control" : "Vestischer Dart Club"}</small>
            <strong>{trainerMode ? "Planung · Steuerung · Analyse" : "Darttraining aus dem Ruhrgebiet"}</strong>
          </div>
          <div className={`club-system is-${health}`} title={latency !== null ? `Datenbankantwort: ${latency} ms` : "Systemstatus wird geprüft"}>
            <span />
            {health === "checking" ? "Verbindung wird geprüft" : health === "online" ? `Datenbank online${latency !== null ? ` · ${latency} ms` : ""}` : "Datenbank nicht erreichbar"}
          </div>
        </header>
        <div className="club-content">{children}</div>
      </section>

      <nav className="club-mobile-nav" aria-label="Mobile Navigation">
        {items.slice(0, 4).map(([href, label, number]) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return <Link key={href} href={href} className={active ? "is-active" : ""}><span>{number}</span><small>{label}</small></Link>;
        })}
        {trainerMode ? (
          <Link href="/"><span>←</span><small>Spieler</small></Link>
        ) : session.authenticated ? (
          <Link href="/trainer" className="club-mobile-login"><span>→</span><small>Trainer</small></Link>
        ) : (
          <Link href="/login" className="club-mobile-login"><span>→</span><small>Login</small></Link>
        )}
      </nav>
    </div>
  );
}
