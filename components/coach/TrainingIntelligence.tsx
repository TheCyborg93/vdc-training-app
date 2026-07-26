"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppFeedback } from "@/components/ui/app-feedback";

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
  const router = useRouter();
  const { notify } = useAppFeedback();
  const [creatingSession, setCreatingSession] = useState<number | null>(null);

  async function createDraft(item: WeeklyPlanItem) {
    setCreatingSession(item.session);
    try {
      const response = await fetch("/api/trainer/ai-coach/create-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `AI Coach · Training ${item.session} · ${item.focus}`,
          focus: item.focus,
          exercises: item.exercises,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Entwurf konnte nicht erstellt werden.");

      const missing = Array.isArray(result.missingExercises) && result.missingExercises.length
        ? ` ${result.missingExercises.length} Empfehlung${result.missingExercises.length === 1 ? " wurde" : "en wurden"} nicht gefunden.`
        : "";
      notify("Trainingsplan-Entwurf erstellt", {
        message: `„${result.plan.title}“ wurde mit ${result.plan.durationMin} Minuten gespeichert.${missing}`,
        tone: missing ? "warning" : "success",
      });
      router.push("/trainer/trainingsplaene");
      router.refresh();
    } catch (error) {
      notify("Entwurf konnte nicht erstellt werden", {
        message: error instanceof Error ? error.message : "Unbekannter Fehler.",
        tone: "error",
      });
    } finally {
      setCreatingSession(null);
    }
  }

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
              <button
                className="button secondary coach-create-plan"
                type="button"
                disabled={creatingSession !== null}
                onClick={() => void createDraft(item)}
              >
                {creatingSession === item.session ? "Entwurf wird erstellt …" : "Als Entwurf erstellen"}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
