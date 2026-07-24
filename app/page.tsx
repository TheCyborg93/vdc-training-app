import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Vestischer Dartclub</div>
        <h1>Training einfach planen und durchführen.</h1>
        <p>
          Diese Grundversion enthält bereits die Struktur für Trainer, Spieler,
          Boards, Übungen, Trainingspläne, Trainingstage und boardbezogene Sitzungen.
        </p>
        <div className="actions">
          <Link className="button" href="/trainingstag">Trainingstag öffnen</Link>
          <Link className="button secondary" href="/trainer">Trainerbereich</Link>
        </div>
      </section>

      <section className="grid">
        <article className="card"><strong>Trainingspläne</strong><div className="kpi">0</div><p>Automatisch erstellen und später per Drag-and-drop bearbeiten.</p></article>
        <article className="card"><strong>Aktive Spieler</strong><div className="kpi">0</div><p>Spieler werden zentral gespeichert und Trainingstagen zugewiesen.</p></article>
        <article className="card"><strong>Verfügbare Boards</strong><div className="kpi">0</div><p>Boards lassen sich verwalten und für Trainingstage aktivieren.</p></article>
      </section>
    </main>
  );
}
