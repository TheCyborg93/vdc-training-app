export type WeeklyChallengeData = {
  area: string;
  title: string;
  description: string;
  target: number;
  unit: string;
  progress: number;
  completed: boolean;
};

export default function WeeklyChallenge({ challenge }: { challenge: WeeklyChallengeData }) {
  const percentage = Math.min(100, Math.round(challenge.progress / Math.max(1, challenge.target) * 100));
  return (
    <article className={`card coach-challenge ${challenge.completed ? "is-completed" : ""}`}>
      <header>
        <div><span className="eyebrow">Persönliche Wochen-Challenge</span><h2>{challenge.title}</h2></div>
        <strong>{percentage}%</strong>
      </header>
      <p>{challenge.description}</p>
      <div className="coach-challenge-progress"><i style={{ width: `${percentage}%` }} /></div>
      <footer>
        <span>{challenge.progress} / {challenge.target} {challenge.unit}</span>
        <b>{challenge.completed ? "Abgeschlossen" : "Diese Woche"}</b>
      </footer>
    </article>
  );
}
