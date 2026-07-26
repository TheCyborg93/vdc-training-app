type BalanceItem = { key: string; label: string; count: number; percentage: number };

export type TrainingIntelligenceData = {
  periodDays: number;
  balance: BalanceItem[];
  undertrained: BalanceItem[];
  overtrained: BalanceItem[];
  recommendation: string;
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
    </section>
  );
}
