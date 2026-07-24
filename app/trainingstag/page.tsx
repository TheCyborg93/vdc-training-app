"use client";

import { useMemo, useState } from "react";

const boards = [
  { id: 1, name: "Board 1", status: "Noch nicht gestartet", players: ["Marvin", "Spieler 2", "Spieler 3"] },
  { id: 2, name: "Board 2", status: "Noch nicht gestartet", players: ["Spieler 4", "Spieler 5", "Spieler 6"] }
];

function shufflePlayers(players: string[]) {
  const shuffled = [...players];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

export default function TrainingDayPage() {
  const [selectedBoard, setSelectedBoard] = useState("1");
  const [started, setStarted] = useState(false);
  const board = boards.find((item) => item.id === Number(selectedBoard)) ?? boards[0];
  const randomOrder = useMemo(() => (started ? shufflePlayers(board.players) : []), [started, board]);

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Veröffentlichter Trainingsplan</div>
        <h1>Doppel unter Druck</h1>
        <p>90 Minuten · 6 Spieler · 2 Boards · Schwerpunkt Doppel und mentale Drucksituationen</p>
        <span className="status">Veröffentlicht</span>
      </section>

      <section className="grid">
        <article className="card"><strong>Ziel</strong><div className="kpi">Doppel</div></article>
        <article className="card"><strong>Dauer</strong><div className="kpi">90 Min.</div></article>
        <article className="card"><strong>Boards</strong><div className="kpi">2</div></article>
      </section>

      <section className="section">
        <h2>Board-Einteilung</h2>
        <div className="board-grid">
          {boards.map((item) => (
            <article className="board" key={item.id}>
              <h3>{item.name}</h3>
              <p>{item.status}</p>
              {item.players.map((player) => <div className="player" key={player}>{player}</div>)}
            </article>
          ))}
        </div>
      </section>

      <section className="section card">
        <h2>Training starten</h2>
        <p>Es wird ausschließlich das Board bestätigt. Eine Spielerauswahl ist nicht vorgesehen.</p>
        <select className="select" value={selectedBoard} onChange={(event) => { setSelectedBoard(event.target.value); setStarted(false); }}>
          {boards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <div className="actions">
          <button className="button" onClick={() => setStarted(true)}>Board bestätigen und starten</button>
        </div>
        {started && (
          <div className="section board">
            <span className="status">Training läuft</span>
            <h3>{board.name}</h3>
            <p>Zufällige Reihenfolge: {randomOrder.join(" → ")}</p>
            <p>Im nächsten Schritt bauen wir hier die erste echte Übungseingabe ein.</p>
          </div>
        )}
      </section>
    </main>
  );
}
