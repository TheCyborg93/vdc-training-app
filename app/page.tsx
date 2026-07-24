import Link from "next/link";

const features = [
  ["Trainingspläne", "Ziel und Dauer wählen, Plan automatisch erstellen und flexibel bearbeiten."],
  ["Board-Verteilung", "Spieler logisch auf verfügbare Boards verteilen und den Trainingstag veröffentlichen."],
  ["Live-Ergebnisse", "Übungsspezifische Eingaben direkt am Board erfassen und automatisch auswerten."]
];

export default function HomePage() {
  return (
    <main>
      <section className="hero hero-home">
        <div className="hero-copy">
          <div className="eyebrow">Training neu organisiert</div>
          <h1>Mehr Struktur.<br /><span>Besseres Training.</span></h1>
          <p>
            Plane Vereinstraining, verteile Spieler auf Boards und dokumentiere
            Ergebnisse direkt während der Einheit – einfach auf Handy, Tablet und PC.
          </p>
          <div className="actions">
            <Link className="button" href="/trainingstag">Trainingstag öffnen</Link>
            <Link className="button secondary" href="/login">Trainer anmelden</Link>
          </div>
        </div>

        <div className="hero-dashboard" aria-label="Vorschau Trainer-Dashboard">
          <div className="dashboard-top"><span>HEUTE</span><strong>Doppel & Checkout</strong></div>
          <div className="dashboard-stat"><small>Dauer</small><b>90 min</b></div>
          <div className="dashboard-stat"><small>Spieler</small><b>12</b></div>
          <div className="dashboard-stat"><small>Boards</small><b>4</b></div>
          <div className="dashboard-progress"><span style={{ width: "68%" }} /></div>
          <p>Plan vorbereitet · Board-Verteilung offen</p>
        </div>
      </section>

      <section className="feature-grid">
        {features.map(([title, text], index) => (
          <article className="feature-card" key={title}>
            <span>0{index + 1}</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
