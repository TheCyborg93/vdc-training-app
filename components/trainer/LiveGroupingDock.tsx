"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppFeedback } from "@/components/ui/app-feedback";

type Strategy = "BALANCED" | "MENTORING" | "SIMILAR";
type PlayerProfile = {
  id: number;
  displayName: string;
  skillLevel: number | null;
  averageScore: number | null;
  resultCount: number;
  rating: number;
};
type Suggestion = {
  trainingDay: { id: number; title: string; goal: string; status: string };
  strategy: Strategy;
  usedCheckedInPlayers: boolean;
  playerCount: number;
  availableBoardCount: number;
  groups: Array<{ boardId: number; boardName: string; players: PlayerProfile[]; averageRating: number }>;
  quality: { spread: number; label: string };
  canApply: boolean;
  warning: string | null;
};

const STRATEGIES: Array<{ id: Strategy; label: string; description: string }> = [
  { id: "BALANCED", label: "Ausgeglichen", description: "Möglichst gleich starke Boards." },
  { id: "MENTORING", label: "Mentoring", description: "Stärkere und weniger erfahrene Spieler gemischt." },
  { id: "SIMILAR", label: "Leistungsgruppen", description: "Ähnliche Spielstärke trainiert zusammen." },
];

export default function LiveGroupingDock() {
  const { confirm, notify } = useAppFeedback();
  const [open, setOpen] = useState(false);
  const [trainingDayId, setTrainingDayId] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<Strategy>("BALANCED");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/trainer/live", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (active && Number.isInteger(data?.id)) setTrainingDayId(data.id); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const loadSuggestion = useCallback(async (dayId: number, selectedStrategy: Strategy) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/trainer/live/grouping?trainingDayId=${dayId}&strategy=${selectedStrategy}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Vorschlag konnte nicht erstellt werden.");
      setSuggestion(payload);
    } catch (error) {
      notify("Einteilung nicht verfügbar", { message: error instanceof Error ? error.message : "Unbekannter Fehler", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (open && trainingDayId) void loadSuggestion(trainingDayId, strategy);
  }, [open, trainingDayId, strategy, loadSuggestion]);

  async function applySuggestion() {
    if (!trainingDayId || !suggestion) return;
    const approved = await confirm({
      title: "Vorgeschlagene Einteilung übernehmen?",
      message: `Die aktuellen Board-Zuweisungen werden ersetzt. ${suggestion.playerCount} Spieler werden auf ${suggestion.groups.filter((group) => group.players.length).length} Boards verteilt.`,
      confirmLabel: "Einteilung übernehmen",
      cancelLabel: "Abbrechen",
    });
    if (!approved) return;

    setApplying(true);
    try {
      const response = await fetch("/api/trainer/live/grouping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingDayId, strategy }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Einteilung konnte nicht übernommen werden.");
      notify("Gruppeneinteilung übernommen", { message: payload.message, tone: "success" });
      await loadSuggestion(trainingDayId, strategy);
      window.dispatchEvent(new CustomEvent("vdc-live-data-changed"));
    } catch (error) {
      notify("Einteilung fehlgeschlagen", { message: error instanceof Error ? error.message : "Unbekannter Fehler", tone: "error" });
    } finally {
      setApplying(false);
    }
  }

  if (!trainingDayId) return null;

  return (
    <section className={`phase6-grouping ${open ? "is-open" : ""}`}>
      <button className="phase6-grouping-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <div><span>COACH ASSISTENT</span><strong>Intelligente Gruppeneinteilung</strong></div>
        <b>{open ? "Schließen" : "Vorschlag öffnen"}</b>
      </button>

      {open && (
        <div className="phase6-grouping-content">
          <nav className="phase6-grouping-strategies" aria-label="Einteilungsstrategie">
            {STRATEGIES.map((item) => (
              <button key={item.id} className={strategy === item.id ? "is-active" : ""} onClick={() => setStrategy(item.id)}>
                <strong>{item.label}</strong><span>{item.description}</span>
              </button>
            ))}
          </nav>

          {loading && <div className="phase6-grouping-loading"><i /><i /><i /></div>}

          {!loading && suggestion && (
            <>
              <header className="phase6-grouping-summary">
                <div><span>Teilnehmer</span><strong>{suggestion.playerCount}</strong><small>{suggestion.usedCheckedInPlayers ? "nur eingecheckte Spieler" : "geplante Spieler ohne Abmeldungen"}</small></div>
                <div><span>Boards</span><strong>{suggestion.groups.filter((group) => group.players.length).length}</strong><small>von {suggestion.availableBoardCount} verfügbar</small></div>
                <div><span>Qualität</span><strong>{suggestion.quality.label}</strong><small>Abweichung {suggestion.quality.spread.toLocaleString("de-DE")} Punkte</small></div>
              </header>

              <div className="phase6-grouping-grid">
                {suggestion.groups.map((group) => (
                  <article key={group.boardId} className={group.players.length ? "" : "is-empty"}>
                    <header><div><span>BOARD</span><strong>{group.boardName}</strong></div><b>Ø {group.averageRating.toLocaleString("de-DE")}</b></header>
                    <div>{group.players.map((player, index) => (
                      <section key={player.id}>
                        <i>{index + 1}</i>
                        <div><strong>{player.displayName}</strong><span>{player.averageScore === null ? "Noch keine aktuellen Ergebnisse" : `Ø ${player.averageScore.toLocaleString("de-DE")} · ${player.resultCount} Ergebnisse`}</span></div>
                        <b>{player.rating.toLocaleString("de-DE")}</b>
                      </section>
                    ))}{group.players.length === 0 && <p>Bleibt frei.</p>}</div>
                  </article>
                ))}
              </div>

              {suggestion.warning && <p className="phase6-grouping-warning">{suggestion.warning}</p>}
              <footer className="phase6-grouping-footer">
                <button onClick={() => void loadSuggestion(trainingDayId, strategy)} disabled={loading || applying}>Neu berechnen</button>
                <button className="is-primary" onClick={() => void applySuggestion()} disabled={!suggestion.canApply || applying}>{applying ? "Wird übernommen …" : "Einteilung übernehmen"}</button>
              </footer>
            </>
          )}
        </div>
      )}
    </section>
  );
}
