import Link from "next/link";

const modules = [
  ["Trainingstag erstellen", "Ziel, Dauer und Plan festlegen", "/trainer"],
  ["Trainingspläne", "Pläne verwalten und bearbeiten", "/trainer"],
  ["Heimtraining", "Individuelle Pläne für Spieler", "/trainer"],
  ["Spieler", "Spieler hinzufügen und verwalten", "/trainer/spieler"],
  ["Boards", "Verfügbare Boards organisieren", "/trainer"],
  ["Übungskatalog", "Übungen und Ergebnistypen pflegen", "/trainer"]
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
        <Link className="button" href="/trainingstag">Trainingstag öffnen</Link>
      </section>

      <section className="stats-row">
        <article><small>Aktive Spieler</small><strong>0</strong><span>Spielerverwaltung verfügbar</span></article>
        <article><small>Verfügbare Boards</small><strong>0</strong><span>noch keine Daten</span></article>
        <article><small>Übungen</small><strong>0</strong><span>Katalog vorbereiten</span></article>
        <article><small>Trainingspläne</small><strong>0</strong><span>ersten Plan erstellen</span></article>
      </section>

      <section className="dashboard-layout">
        <div>
          <div className="section-heading"><div><span className="eyebrow">Verwaltung</span><h2>Schnellzugriffe</h2></div></div>
          <div className="module-grid">
            {modules.map(([title, text, href], index) => (
              <Link className="module-card" href={href} key={title}>
                <span className="module-number">0{index + 1}</span>
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
          <button className="button full" type="button">Training erstellen</button>
        </aside>
      </section>
    </main>
  );
}
