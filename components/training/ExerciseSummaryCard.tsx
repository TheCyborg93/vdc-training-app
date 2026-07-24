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
    <section style={{ marginBottom: 24, padding: 24, border: "1px solid rgba(255,52,73,.45)", background: "linear-gradient(145deg,rgba(255,52,73,.13),#111317)", boxShadow: "0 22px 60px rgba(0,0,0,.28)" }} aria-live="polite">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <span className="eyebrow">Übung abgeschlossen</span>
          <h2 style={{ marginTop: 8, fontSize: "clamp(1.8rem,4vw,3rem)" }}>{summary.title}</h2>
          {summary.playerName && <p style={{ margin: "6px 0 0" }}>{summary.playerName}</p>}
        </div>
        <button className="button secondary" onClick={onClose}>Weiter</button>
      </div>
      <strong style={{ display: "block", marginTop: 20, fontSize: "1.1rem", color: "#fff" }}>{summary.highlight}</strong>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 20 }}>
        {summary.metrics.map((metric) => (
          <article key={metric.label} style={{ display: "grid", gap: 6, padding: 16, border: "1px solid rgba(255,255,255,.1)", background: "#0b0d10" }}>
            <small style={{ color: "#9ca3ad", textTransform: "uppercase", letterSpacing: ".08em" }}>{metric.label}</small>
            <strong style={{ fontSize: "1.65rem", color: "#ff6574" }}>{metric.value}</strong>
            {metric.detail && <span style={{ color: "#9ca3ad", fontSize: ".82rem" }}>{metric.detail}</span>}
          </article>
        ))}
      </div>
    </section>
  );
}
