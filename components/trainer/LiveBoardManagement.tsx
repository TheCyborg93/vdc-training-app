"use client";

import { useMemo, useState } from "react";
import { useAppFeedback } from "@/components/ui/app-feedback";

type Player = { id: number; displayName: string };
type Board = {
  id: number;
  board: { id: number; name: string; location?: string | null; available?: boolean };
  status: "NOT_STARTED" | "RUNNING" | "PAUSED" | "COMPLETED";
  players: Player[];
};

type Props = {
  trainingDayId: number;
  boards: Board[];
  unassignedPlayers: Player[];
  onChanged: () => Promise<void> | void;
};

function boardState(board: Board) {
  if (board.status === "COMPLETED") return "Fertig";
  if (board.status === "PAUSED") return "Pause";
  if (board.status === "RUNNING") return "Aktiv";
  if (board.players.length === 0) return "Frei";
  return "Bereit";
}

export default function LiveBoardManagement({ trainingDayId, boards, unassignedPlayers, onChanged }: Props) {
  const { notify } = useAppFeedback();
  const [open, setOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [busyPlayerId, setBusyPlayerId] = useState<number | null>(null);
  const [dragPlayerId, setDragPlayerId] = useState<number | null>(null);

  const allPlayers = useMemo(() => [...boards.flatMap((board) => board.players), ...unassignedPlayers], [boards, unassignedPlayers]);
  const selectedPlayer = allPlayers.find((player) => player.id === selectedPlayerId) ?? null;
  const freeBoards = boards.filter((board) => board.players.length === 0 && board.status !== "COMPLETED").length;

  async function move(playerId: number, targetBoardId: number | null) {
    if (busyPlayerId !== null) return;
    setBusyPlayerId(playerId);
    try {
      const response = await fetch("/api/trainer/live/board-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingDayId, playerId, targetBoardId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Spieler konnte nicht verschoben werden.");
      notify(payload.message ?? "Boardzuweisung aktualisiert.", { tone: "success" });
      setSelectedPlayerId(null);
      setDragPlayerId(null);
      await onChanged();
    } catch (error) {
      notify("Umbesetzung nicht möglich", { message: error instanceof Error ? error.message : "Unbekannter Fehler", tone: "error" });
    } finally {
      setBusyPlayerId(null);
    }
  }

  function chooseTarget(targetBoardId: number | null) {
    const playerId = selectedPlayerId ?? dragPlayerId;
    if (playerId !== null) void move(playerId, targetBoardId);
  }

  return (
    <section className={`phase6-board-manager ${open ? "is-open" : ""}`} aria-label="Live Boardverwaltung">
      <header className="phase6-board-manager-head">
        <div>
          <span>BOARD MANAGEMENT</span>
          <h2>Spieler und Boards live verwalten</h2>
          <p>Per Drag & Drop oder Spieler auswählen und anschließend das Zielboard antippen.</p>
        </div>
        <div className="phase6-board-manager-summary">
          <span><strong>{freeBoards}</strong> freie Boards</span>
          <span><strong>{unassignedPlayers.length}</strong> auf der Bank</span>
          <button type="button" onClick={() => { setOpen((value) => !value); setSelectedPlayerId(null); }}>
            {open ? "Verwaltung schließen" : "Boards verwalten"}
          </button>
        </div>
      </header>

      {open && (
        <div className="phase6-board-manager-body">
          {selectedPlayer && <div className="phase6-board-manager-selection"><span>Ausgewählt</span><strong>{selectedPlayer.displayName}</strong><button onClick={() => setSelectedPlayerId(null)}>Auswahl lösen</button></div>}

          <div
            className={`phase6-board-bank ${selectedPlayerId !== null || dragPlayerId !== null ? "is-target" : ""}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); chooseTarget(null); }}
            onClick={() => { if (selectedPlayerId !== null) chooseTarget(null); }}
          >
            <header><div><span>SPIELERBANK</span><h3>Nicht zugewiesen</h3></div><strong>{unassignedPlayers.length}</strong></header>
            <div className="phase6-board-player-list">
              {unassignedPlayers.map((player) => (
                <button
                  type="button"
                  draggable={busyPlayerId === null}
                  className={selectedPlayerId === player.id ? "is-selected" : ""}
                  key={player.id}
                  disabled={busyPlayerId !== null}
                  onClick={(event) => { event.stopPropagation(); setSelectedPlayerId((value) => value === player.id ? null : player.id); }}
                  onDragStart={() => { setDragPlayerId(player.id); setSelectedPlayerId(player.id); }}
                  onDragEnd={() => setDragPlayerId(null)}
                >
                  <i />
                  <span>{player.displayName}</span>
                  <small>{busyPlayerId === player.id ? "Wird verschoben …" : "Bereit"}</small>
                </button>
              ))}
              {unassignedPlayers.length === 0 && <p>Alle anwesenden Spieler sind einem Board zugewiesen.</p>}
            </div>
          </div>

          <div className="phase6-board-manager-grid">
            {boards.map((board) => {
              const locked = board.status === "COMPLETED";
              return (
                <article
                  key={board.id}
                  className={`phase6-board-slot status-${board.status.toLowerCase()} ${selectedPlayerId !== null && !locked ? "is-target" : ""} ${locked ? "is-locked" : ""}`}
                  onDragOver={(event) => { if (!locked) event.preventDefault(); }}
                  onDrop={(event) => { event.preventDefault(); if (!locked) chooseTarget(board.board.id); }}
                  onClick={() => { if (selectedPlayerId !== null && !locked) chooseTarget(board.board.id); }}
                >
                  <header>
                    <div><span>{board.board.name}</span><small>{board.board.location ?? "Trainingsbereich"}</small></div>
                    <strong>{boardState(board)}</strong>
                  </header>
                  <div className="phase6-board-player-list">
                    {board.players.map((player) => (
                      <button
                        type="button"
                        draggable={!locked && busyPlayerId === null}
                        className={selectedPlayerId === player.id ? "is-selected" : ""}
                        key={player.id}
                        disabled={locked || busyPlayerId !== null}
                        onClick={(event) => { event.stopPropagation(); setSelectedPlayerId((value) => value === player.id ? null : player.id); }}
                        onDragStart={() => { setDragPlayerId(player.id); setSelectedPlayerId(player.id); }}
                        onDragEnd={() => setDragPlayerId(null)}
                      >
                        <i />
                        <span>{player.displayName}</span>
                        <small>{busyPlayerId === player.id ? "Wird verschoben …" : "Verschieben"}</small>
                      </button>
                    ))}
                    {board.players.length === 0 && <p>Board frei – Spieler hier ablegen.</p>}
                  </div>
                  {selectedPlayerId !== null && !locked && <div className="phase6-board-drop-hint">Hier zuweisen</div>}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
