type Summary = {
  title: string;
  kind: string;
  playerName?: string;
  highlight: string;
  metrics: { label: string; value: string; detail?: string }[];
};

type Props = {
  summary: Summary;
  onClose: () => void;
};

export default function ExerciseSummaryCard({ summary, onClose }: Props) {
  return (
    <section className="exercise-summary-card" aria-live="polite">
      <div className="exercise-summary-head">
        <div>
          <span className="eyebrow">Übung abgeschlossen</span>
          <h2>{summary.title}</h2>
          {summary.playerName && <p>{summary.playerName}</p>}
        </div>
        <button className="button secondary" onClick={onClose}>Schließen</button>
      </div>
      <strong className="exercise-summary-highlight">{summary.highlight}</strong>
      <div className="exercise-summary-grid">
        {summary.metrics.map((metric) => (
          <article key={metric.label}>
            <small>{metric.label}</small>
            <strong>{metric.value}</strong>
            {metric.detail && <span>{metric.detail}</span>}
          </article>
        ))}
      </div>
    </section>
  );
}
