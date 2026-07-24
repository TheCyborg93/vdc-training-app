"use client";

import { useEffect, useMemo, useState } from "react";

type Plan = { id: number; title: string; goal: string; durationMin: number; exercises: { id: number }[] };
type Player = { id: number; displayName: string; skillLevel: number | null };
type Board = { id: number; name: string; location: string | null };
type Assignment = { boardId: number; playerId: number; position: number };
type TrainingDay = { id: number; trainingDate: string; status: string; trainingPlan: Plan; assignments: { id: number; board: Board; player: Player }[] };

type ApiData = { plans: Plan[]; players: Player[]; boards: Board[]; trainingDays: TrainingDay[] };

export default function PublishTrainingDayPage() {
  const [data, setData] = useState<ApiData>({ plans: [], players: [], boards: [], trainingDays: [] });
  const [trainingPlanId, setTrainingPlanId] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [boardIds, setBoardIds] = useState<number[]>([]);
  const [playerIds, setPlayerIds] = useState<number[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch("/api/training-days", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Daten konnten nicht geladen werden.");
      setData(result);
      if (!trainingPlanId && result.plans?.[0]) setTrainingPlanId(String(result.plans[0].id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Daten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const selectedPlan = useMemo(() => data.plans.find((plan) => plan.id === Number(trainingPlanId)), [data.plans, trainingPlanId]);

  function toggleId(id: number, current: number[], setter: (value: number[]) => void) {
    setter(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setAssignments([]);
  }

  function generateAssignments() {
    setMessage("");
    if (!boardIds.length || !playerIds.length) {
      setMessage("Wähle zuerst mindestens ein Board und einen Spieler aus.");
      return;
    }

    const selectedPlayers = data.players
      .filter((player) => playerIds.includes(player.id))
      .sort((a, b) => (b.skillLevel ?? 0) - (a.skillLevel ?? 0));

    const groups = boardIds.map((boardId) => ({ boardId, players: [] as Player[] }));
    selectedPlayers.forEach((player, index) => {
      const cycle = Math.floor(index / groups.length);
      const groupIndex = cycle % 2 === 0 ? index % groups.length : groups.length - 1 - (index % groups.length);
      groups[groupIndex].players.push(player);
    });

    setAssignments(groups.flatMap((group) => group.players.map((player, index) => ({ boardId: group.boardId, playerId: player.id, position: index + 1 }))));
  }

  function movePlayer(playerId: number, targetBoardId: number) {
    const remaining = assignments.filter((assignment) => assignment.playerId !== playerId);
    const targetCount = remaining.filter((assignment) => assignment.boardId === targetBoardId).length;
    const updated = [...remaining, { boardId: targetBoardId, playerId, position: targetCount + 1 }];
    setAssignments(boardIds.flatMap((boardId) => updated.filter((assignment) => assignment.boardId === boardId).map((assignment, index) => ({ ...assignment, position: index + 1 }))));
  }

  async function publish() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/training-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingPlanId: Number(trainingPlanId), trainingDate, boardIds, playerIds, assignments }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Veröffentlichen fehlgeschlagen.");
      setMessage("Trainingstag wurde veröffentlicht.");
      setBoardIds([]);
      setPlayerIds([]);
      setAssignments([]);
      setTrainingDate("");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Veröffentlichen fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-heading">
        <div><div className="eyebrow">Trainerbereich</div><h1>Trainingstag veröffentlichen</h1><p>Plan, Boards und anwesende Spieler auswählen und logisch verteilen.</p></div>
      </section>

      {loading ? <div className="card"><p>Daten werden geladen …</p></div> : (
        <section className="publish-layout">
          <div className="card publish-settings">
            <div className="section-heading"><div><span className="eyebrow">Schritt 1</span><h2>Grunddaten</h2></div></div>
            <label>Trainingsplan<select value={trainingPlanId} onChange={(event) => setTrainingPlanId(event.target.value)}><option value="">Plan auswählen …</option>{data.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</select></label>
            <label>Datum und Uhrzeit<input type="datetime-local" value={trainingDate} onChange={(event) => setTrainingDate(event.target.value)} /></label>
            {selectedPlan && <div className="plan-summary"><strong>{selectedPlan.title}</strong><span>{selectedPlan.goal} · {selectedPlan.durationMin} Minuten · {selectedPlan.exercises.length} Übungen</span></div>}

            <div className="section-heading compact"><div><span className="eyebrow">Schritt 2</span><h2>Boards wählen</h2></div></div>
            <div className="selection-grid">{data.boards.map((board) => <label className={`selection-card ${boardIds.includes(board.id) ? "is-selected" : ""}`} key={board.id}><input type="checkbox" checked={boardIds.includes(board.id)} onChange={() => toggleId(board.id, boardIds, setBoardIds)} /><strong>{board.name}</strong><span>{board.location || "Kein Standort"}</span></label>)}</div>

            <div className="section-heading compact"><div><span className="eyebrow">Schritt 3</span><h2>Spieler wählen</h2></div></div>
            <div className="selection-grid">{data.players.map((player) => <label className={`selection-card ${playerIds.includes(player.id) ? "is-selected" : ""}`} key={player.id}><input type="checkbox" checked={playerIds.includes(player.id)} onChange={() => toggleId(player.id, playerIds, setPlayerIds)} /><strong>{player.displayName}</strong><span>{player.skillLevel ? `Stufe ${player.skillLevel}` : "Ohne Einstufung"}</span></label>)}</div>
            <button className="button secondary full" type="button" onClick={generateAssignments}>Spieler automatisch verteilen</button>
          </div>

          <section>
            <div className="section-heading"><div><span className="eyebrow">Schritt 4</span><h2>Verteilung prüfen</h2></div></div>
            {!assignments.length ? <div className="card"><p>Nach Auswahl der Boards und Spieler wird hier die automatische Verteilung angezeigt.</p></div> : <div className="assignment-board-grid">{boardIds.map((boardId) => {
              const board = data.boards.find((item) => item.id === boardId);
              const boardAssignments = assignments.filter((item) => item.boardId === boardId).sort((a, b) => a.position - b.position);
              return <article className="assignment-board" key={boardId}><div className="assignment-board-head"><div><span className="eyebrow">Board</span><h3>{board?.name}</h3></div><strong>{boardAssignments.length} Spieler</strong></div>{boardAssignments.map((assignment) => {
                const player = data.players.find((item) => item.id === assignment.playerId);
                return <div className="assignment-player" key={assignment.playerId}><span>{assignment.position}</span><strong>{player?.displayName}</strong><select value={assignment.boardId} onChange={(event) => movePlayer(assignment.playerId, Number(event.target.value))}>{boardIds.map((targetId) => <option value={targetId} key={targetId}>{data.boards.find((item) => item.id === targetId)?.name}</option>)}</select></div>;
              })}</article>;
            })}</div>}
            <button className="button full publish-button" disabled={saving || !trainingPlanId || !trainingDate || assignments.length !== playerIds.length} onClick={publish}>{saving ? "Veröffentlicht …" : "Trainingstag bestätigen und veröffentlichen"}</button>
            {message && <p className="form-message">{message}</p>}
          </section>
        </section>
      )}

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">Veröffentlicht</span><h2>Letzte Trainingstage</h2></div></div>
        <div className="saved-plan-grid">{data.trainingDays.length === 0 ? <div className="card"><p>Noch kein Trainingstag veröffentlicht.</p></div> : data.trainingDays.map((day) => <article className="saved-plan-card" key={day.id}><span className="status">{day.status}</span><h3>{day.trainingPlan.title}</h3><p>{new Date(day.trainingDate).toLocaleString("de-DE")} · {new Set(day.assignments.map((item) => item.board.id)).size} Boards · {day.assignments.length} Spieler</p></article>)}</div>
      </section>
    </main>
  );
}
