"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./statistics-v2.module.css";

type PlayerStat = {
  playerId: number;
  firstName: string;
  dartName: string;
  performanceIndex: number;
  trend: number;
  activeDays: number;
  resultCount: number;
  averagePerformance: number;
  checkoutRate: number;
  strongest: string;
  weakest: string;
};

type ExerciseStat = {
  exerciseId: number;
  name: string;
  resultCount: number;
  playerCount: number;
  averagePerformance: number;
  checkoutRate: number | null;
};

type Data = {
  overview: {
    players: number;
    results: number;
    activeDays: number;
    averagePerformance: number;
    checkoutRate: number;
    clubResults: number;
    homeResults: number;
  };
  highlights: {
    bestExercise: ExerciseStat | null;
    mostActivePlayer: PlayerStat | null;
    biggestImprovement: PlayerStat | null;
  };
  players: PlayerStat[];
  exercises: ExerciseStat[];
  trend: { week: string; value: number; results: number }[];
  activity: { date: string; club: number; home: number; total: number }[];
};

const periods = [
  ["7", "7 Tage"],
  ["30", "30 Tage"],
  ["90", "90 Tage"],
  ["365", "12 Monate"],
  ["all", "Gesamt"],
];

function trendClass(value: number) {
  if (value > 1) return styles.trendUp;
  if (value < -1) return styles.trendDown;
  return styles.trendFlat;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

export default function StatisticsV2Page() {
  const [period, setPeriod] = useState("90");
  const [source, setSource] = useState("ALL");
  const [playerId, setPlayerId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"players" | "exercises">("players");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ period, source });
    if (playerId) params.set("playerId", playerId);
    fetch(`/api/trainer/statistics-v2?${params.toString()}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Statistiken konnten nicht geladen werden.");
        setData(body);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Statistiken konnten nicht geladen werden.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [period, source, playerId]);

  const maxTrend = useMemo(() => Math.max(100, ...(data?.trend.map((item) => item.value) ?? [100])), [data]);
  const maxActivity = useMemo(() => Math.max(1, ...(data?.activity.map((item) => item.total) ?? [1])), [data]);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>Engine V3 · Analyse</div>
          <h1>Statistiken V2</h1>
          <p>Vereins- und Heimtraining gemeinsam analysieren, Entwicklungen erkennen und Spieler gezielt vergleichen.</p>
        </div>
        <div className={styles.filters}>
          <select aria-label="Zeitraum" value={period} onChange={(event) => setPeriod(event.target.value)}>
            {periods.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <select aria-label="Trainingsquelle" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="ALL">Alle Trainings</option>
            <option value="CLUB">Nur Verein</option>
            <option value="HOME">Nur Heimtraining</option>
          </select>
          <select aria-label="Spieler" value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
            <option value="">Alle Spieler</option>
            {data?.players.map((player) => <option key={player.playerId} value={player.playerId}>{player.dartName}</option>)}
          </select>
        </div>
      </section>

      {loading ? <div className={styles.loading}>Statistiken werden ausgewertet …</div> : error ? <section className={styles.panel}><p>{error}</p></section> : data && (
        <>
          <section className={styles.grid}>
            <Metric label="Aufnahmen" value={data.overview.results} />
            <Metric label="Aktive Tage" value={data.overview.activeDays} />
            <Metric label="Leistung" value={`${data.overview.averagePerformance} %`} />
            <Metric label="Checkoutquote" value={`${data.overview.checkoutRate} %`} />
            <Metric label="Spieler" value={data.overview.players} />
            <Metric label="Verein" value={data.overview.clubResults} />
            <Metric label="Heimtraining" value={data.overview.homeResults} />
            <Metric label="Rhythmus" value="2× / Woche" />
          </section>

          <section className={styles.highlights}>
            <Highlight label="Beste Übung" title={data.highlights.bestExercise?.name ?? "Noch offen"} value={data.highlights.bestExercise ? `${data.highlights.bestExercise.averagePerformance} % Leistung` : "Mindestens drei Ergebnisse nötig"} />
            <Highlight label="Trainingsfleiß" title={data.highlights.mostActivePlayer?.dartName ?? "Noch offen"} value={data.highlights.mostActivePlayer ? `${data.highlights.mostActivePlayer.activeDays} aktive Tage` : "Keine Daten"} />
            <Highlight label="Größte Entwicklung" title={data.highlights.biggestImprovement?.dartName ?? "Noch offen"} value={data.highlights.biggestImprovement ? `${data.highlights.biggestImprovement.trend >= 0 ? "+" : ""}${data.highlights.biggestImprovement.trend} Punkte Trend` : "Keine Daten"} />
          </section>

          <section className={styles.panels}>
            <article className={styles.panel}>
              <div className={styles.panelHead}><div><div className={styles.eyebrow}>Formkurve</div><h2>Leistungsentwicklung</h2></div><span className={styles.muted}>Wochenmittel</span></div>
              {data.trend.length ? <div className={styles.chart}>
                {data.trend.map((item) => <div className={styles.barWrap} key={item.week} title={`${formatDate(item.week)} · ${item.value} % · ${item.results} Ergebnisse`}>
                  <div className={styles.bar} style={{ height: `${Math.max(3, item.value / maxTrend * 100)}%` }} />
                  <small>{formatDate(item.week)}</small>
                </div>)}
              </div> : <div className={styles.empty}>Noch keine Formkurve verfügbar.</div>}
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHead}><div><div className={styles.eyebrow}>Aktivität</div><h2>Letzte Trainingstage</h2></div></div>
              {data.activity.length ? <>
                <div className={styles.activity}>
                  {data.activity.slice(-15).map((item) => <div className={styles.activityDay} key={item.date} title={`${formatDate(item.date)} · Verein ${item.club} · Zuhause ${item.home}`}>
                    <div className={styles.club} style={{ height: `${Math.max(2, item.club / maxActivity * 100)}%` }} />
                    <div className={styles.home} style={{ height: `${Math.max(2, item.home / maxActivity * 100)}%` }} />
                  </div>)}
                </div>
                <div className={styles.legend}><span><i className={`${styles.dot} ${styles.dotClub}`} />Verein</span><span><i className={`${styles.dot} ${styles.dotHome}`} />Heimtraining</span></div>
              </> : <div className={styles.empty}>Noch keine Aktivität vorhanden.</div>}
            </article>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div><div className={styles.eyebrow}>Detailanalyse</div><h2>{view === "players" ? "Spielerranking" : "Übungsanalyse"}</h2></div>
              <div className={styles.tabs}>
                <button className={view === "players" ? styles.active : ""} onClick={() => setView("players")}>Spieler</button>
                <button className={view === "exercises" ? styles.active : ""} onClick={() => setView("exercises")}>Übungen</button>
              </div>
            </div>
            {view === "players" ? <PlayerTable players={data.players} /> : <ExerciseTable exercises={data.exercises} />}
          </section>
        </>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong></article>;
}

function Highlight({ label, title, value }: { label: string; title: string; value: string }) {
  return <article className={styles.highlight}><small>{label}</small><strong>{title}</strong><span>{value}</span></article>;
}

function PlayerTable({ players }: { players: PlayerStat[] }) {
  if (!players.length) return <div className={styles.empty}>Keine Spielergebnisse im gewählten Zeitraum.</div>;
  return <div className={styles.table}>
    <div className={`${styles.row} ${styles.rowHeader}`}><span>Rang</span><span>Spieler</span><span>Index</span><span className={styles.hideMobile}>Leistung</span><span className={styles.hideTablet}>Checkout</span><span className={styles.hideTablet}>Stärke</span><span className={styles.hideMobile}>Trend</span></div>
    {players.map((player, index) => <div className={styles.row} key={player.playerId}>
      <span className={styles.rank}>{index + 1}</span>
      <div className={styles.player}><Link href={`/trainer/spieler/${player.playerId}`}><strong>{player.dartName}</strong></Link><small>{player.firstName} · {player.resultCount} Aufnahmen</small></div>
      <div><strong>{player.performanceIndex}</strong><div className={styles.progress}><span style={{ width: `${player.performanceIndex / 10}%` }} /></div></div>
      <span className={styles.hideMobile}>{player.averagePerformance} %</span>
      <span className={styles.hideTablet}>{player.checkoutRate} %</span>
      <span className={styles.hideTablet}>{player.strongest}</span>
      <strong className={`${styles.hideMobile} ${trendClass(player.trend)}`}>{player.trend > 0 ? "+" : ""}{player.trend}</strong>
    </div>)}
  </div>;
}

function ExerciseTable({ exercises }: { exercises: ExerciseStat[] }) {
  if (!exercises.length) return <div className={styles.empty}>Keine Übungen im gewählten Zeitraum.</div>;
  return <div className={styles.table}>
    <div className={`${styles.row} ${styles.rowHeader}`}><span>#</span><span>Übung</span><span>Leistung</span><span className={styles.hideMobile}>Aufnahmen</span><span className={styles.hideTablet}>Spieler</span><span className={styles.hideTablet}>Checkout</span><span className={styles.hideMobile}>Nutzung</span></div>
    {exercises.map((exercise, index) => <div className={styles.row} key={exercise.exerciseId}>
      <span className={styles.rank}>{index + 1}</span>
      <div className={styles.exercise}><strong>{exercise.name}</strong><small>{exercise.playerCount} Spieler</small></div>
      <div><strong>{exercise.averagePerformance} %</strong><div className={styles.progress}><span style={{ width: `${exercise.averagePerformance}%` }} /></div></div>
      <span className={styles.hideMobile}>{exercise.resultCount}</span>
      <span className={styles.hideTablet}>{exercise.playerCount}</span>
      <span className={styles.hideTablet}>{exercise.checkoutRate == null ? "–" : `${exercise.checkoutRate} %`}</span>
      <span className={styles.hideMobile}>{exercise.resultCount >= 20 ? "Sehr hoch" : exercise.resultCount >= 8 ? "Regelmäßig" : "Selten"}</span>
    </div>)}
  </div>;
}
