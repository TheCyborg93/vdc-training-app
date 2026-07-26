type BalanceItem = { key: string; label: string; count: number; percentage: number };
type WeeklyPlanItem = {
  session: number;
  title: string;
  focus: string;
  purpose: string;
  exercises: string[];
};

export type TrainingIntelligenceData = {
  periodDays: number;
  balance: BalanceItem[];
  undertrained: BalanceItem[];
  overtrained: BalanceItem[];
  recommendation: string;
  weeklyPlan: WeeklyPlanItem[];
};

export default function TrainingIntelligence({ data }: { data: TrainingIntelligenceData }) {
  return (
    <section className="coach-intelligence card">
      <header>
        <div><span className="eyebrow">Trainingsintelligenz</span><h2>Verteilung der letzten {data.periodDays} Tage</h2></div>
        <p>{data.recommendation}</p>
      </header>
      <div className="coach-balance-grid">
        {data.balance.map((item) => {
          const undertrained = data.undertrained.some((entry) => entry.key === item.key);
          const overtrained = data.overtrained.some((entry) => entry.key === item.key);
          return (
            <div key={item.key} className={undertrained ? "is-undertrained" : overtrained ? "is-overtrained" : ""}>
              <span><strong>{item.label}</strong><b>{item.percentage}%</b></span>
              <div><i style={{ width: `${item.percentage}%` }} /></div>
              <small>{item.count} gespeicherte Aufnahmen</small>
            </div>
          );
        })}
      </div>
      <div className="coach-week-plan">
        <div className="coach-week-plan-heading">
          <span className="eyebrow">2 Trainingstage pro Woche</span>
          <h3>Empfohlene Aufteilung der nächsten Woche</h3>
        </div>
        <div className="coach-week-plan-grid">
          {data.weeklyPlan.map((item) => (
            <article key={item.session}>
              <small>Termin {item.session}</small>
              <h4>{item.title}</h4>
              <p>{item.purpose}</p>
              <div>{item.exercises.map((exercise) => <span key={exercise}>{exercise}</span>)}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
