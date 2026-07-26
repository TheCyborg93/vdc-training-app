"use client";

import Link from "next/link";
import { useState } from "react";
import { useAppFeedback } from "@/components/ui/app-feedback";

type SyncResult = { created: number; updated: number; deleted: number; deactivated: number; total: number; message: string };

export default function ExerciseCatalogSyncPage() {
  const { confirm, notify } = useAppFeedback();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function syncCatalog() {
    const accepted = await confirm({
      title: "100er-Übungskatalog übernehmen?",
      message: "Alle 100 neuen Übungen werden erstellt oder aktualisiert. Alte unbenutzte Übungen werden gelöscht. Bereits verwendete Altübungen bleiben für bestehende Statistiken erhalten, werden aber deaktiviert.",
      confirmLabel: "Katalog ersetzen",
      cancelLabel: "Abbrechen",
      destructive: true,
    });
    if (!accepted) return;

    setRunning(true);
    try {
      const response = await fetch("/api/trainer/exercise-catalog/sync", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Katalog konnte nicht synchronisiert werden.");
      setResult(data as SyncResult);
      notify("100er-Katalog übernommen", { message: data.message, tone: "success" });
    } catch (error) {
      notify("Katalog-Synchronisierung fehlgeschlagen", { message: error instanceof Error ? error.message : "Unbekannter Fehler", tone: "error" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="dashboard-page">
      <header className="vdc-page-heading">
        <div><span className="vdc-kicker">Übungskatalog</span><h1>100er-Katalog übernehmen</h1><p>Ersetzt den bisherigen Übungskatalog durch die neue kategorisierte Sammlung mit passenden Ergebnis-Engines.</p></div>
        <Link className="button secondary" href="/trainer/uebungen">Zurück zum Katalog</Link>
      </header>

      <section className="club-panel admin-form">
        <div className="section-heading"><div><span className="eyebrow">Datenbankaktion</span><h2>Was wird geändert?</h2></div></div>
        <div className="vdc-system-grid">
          <article><small>Neue Übungen</small><strong>100</strong><span>Vollständig kategorisiert</span></article>
          <article><small>Engine-Konfiguration</small><strong>Aktiv</strong><span>Ziele, Limits und Regeln pro Übung</span></article>
          <article><small>Historie</small><strong>Geschützt</strong><span>Verwendete Altübungen werden deaktiviert</span></article>
        </div>
        <p>Trainingspläne und bereits gespeicherte Ergebnisse werden nicht gelöscht. Nicht mehr benötigte Altübungen ohne Verknüpfungen werden entfernt.</p>
        <button className="button" disabled={running} onClick={() => void syncCatalog()}>{running ? "Katalog wird synchronisiert …" : "100er-Katalog jetzt übernehmen"}</button>
      </section>

      {result && <section className="club-panel"><div className="section-heading"><div><span className="eyebrow">Abgeschlossen</span><h2>Synchronisierung erfolgreich</h2></div></div><div className="stats-row"><article><small>Erstellt</small><strong>{result.created}</strong></article><article><small>Aktualisiert</small><strong>{result.updated}</strong></article><article><small>Gelöscht</small><strong>{result.deleted}</strong></article><article><small>Deaktiviert</small><strong>{result.deactivated}</strong></article></div><Link className="button" href="/trainer/uebungen">Übungskatalog öffnen</Link></section>}
    </main>
  );
}
