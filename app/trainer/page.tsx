const modules = [
  "Trainingstag erstellen",
  "Trainingspläne",
  "Heimtrainingspläne",
  "Spielerverwaltung",
  "Boardverwaltung",
  "Übungskatalog",
  "Statistiken"
];

export default function TrainerPage() {
  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Login folgt im nächsten Schritt</div>
        <h1>Trainerbereich</h1>
        <p>Das Grundlayout steht. Als Nächstes verbinden wir die Module mit Supabase PostgreSQL.</p>
      </section>
      <section className="grid">
        {modules.map((module) => (
          <article className="card" key={module}>
            <strong>{module}</strong>
            <p>Modul vorbereitet – Funktionen werden schrittweise ergänzt.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
