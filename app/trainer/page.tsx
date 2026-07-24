import Link from "next/link";

const modules = [
  ["Trainingstag veröffentlichen", "Plan, Boards und Spieler zusammenstellen", "/trainer/trainingstag"],
  ["Live-Training", "Boards, Übungen und Fortschritt verfolgen", "/trainer/live"],
  ["Statistiken", "Entwicklung und Ergebnisse der Spieler", "/statistik"],
  ["Trainingspläne", "Pläne erstellen und verwalten", "/trainer/trainingsplaene"],
  ["Heimtraining", "Individuelle Pläne für Spieler", "/trainer"],
  ["Spieler", "Spieler hinzufügen und verwalten", "/trainer/spieler"],
  ["Boards", "Verfügbare Boards organisieren", "/trainer/boards"],
  ["Übungskatalog", "Übungen und Ergebnistypen pflegen", "/trainer/uebungen"]
];

export default function TrainerPage() {
  return (
    <main className="dashboard-page">
      <section className="dashboard-heading">
        <div>
          <div className="eyebrow">Trainerzentrale</div>
          <h1>Guten Morgen, Trainer.</h1>
          <p>Alles für den nächsten Trainingstag auf einen Blick.</p>
        </div>
        <Link className="button" href="/training">Trainingstag öffnen</Link>
      </section>

      <section className="stats-row">
        <article><small>Aktive Spieler</small><strong>0</strong><span>Spielerverwaltung verfügbar</span></article>
        <article><small>Verfügbare Boards</small><strong>0</strong><span>Boardverwaltung verfügbar</span></article>
        <article><small>Übungen</small><strong>0</strong><span>Übungskatalog verfügbar</span></article>
        <article><small>Trainingspläne</small><strong>0</strong><span>Generator verfügbar</span></article>
      </section>

      <section className="dashboard-layout">
        <div>
          <div className="section-heading"><div><span className="eyebrow">Verwaltung</span><h2>Schnellzugriffe</h2></div></div>
          <div className="module-grid">
            {modules.map(([title, text, href], index) => (
              <Link className="module-card" href={href} key={title}>
                <span className="module-number">{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{title}</strong><p>{text}</p></div>
                <b>→</b>
              </Link>
            ))}
          </div>
        </div>

        <aside className="next-training">
          <span className="eyebrow">Nächstes Training</span>
          <h2>Noch nicht geplant</h2>
          <p>Erstelle einen Trainingsplan und veröffentliche anschließend den Trainingstag.</p>
          <div className="empty-timeline"><span /><span /><span /></div>
          <Link className="button full" href="/trainer/trainingstag">Trainingstag veröffentlichen</Link>
        </aside>
      </section>
    </main>
  );
}
