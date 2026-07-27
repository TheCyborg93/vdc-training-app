"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppFeedback } from "@/components/ui/app-feedback";

type AttendanceStatus = "EXPECTED" | "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "NOT_REGISTERED";

type Participant = {
  id: number;
  displayName: string;
  firstName: string;
  registered: boolean;
  status: AttendanceStatus;
  checkedInAt: string | null;
  note: string | null;
  board: { id: number; name: string } | null;
};

type AttendancePayload = {
  participants: Participant[];
  summary: {
    total: number;
    present: number;
    late: number;
    expected: number;
    absent: number;
    excused: number;
  };
};

type Filter = "ALL" | "OPEN" | "HERE" | "AWAY";

const STATUS_COPY: Record<AttendanceStatus, { label: string; short: string }> = {
  EXPECTED: { label: "Erwartet", short: "Offen" },
  PRESENT: { label: "Anwesend", short: "Da" },
  LATE: { label: "Verspätet", short: "Spät" },
  ABSENT: { label: "Abwesend", short: "Fehlt" },
  EXCUSED: { label: "Entschuldigt", short: "Entsch." },
  NOT_REGISTERED: { label: "Nicht eingeplant", short: "Nicht geplant" },
};

export default function LiveAttendancePanel({ trainingDayId, onChanged }: { trainingDayId: number; onChanged: () => void | Promise<void> }) {
  const { notify } = useAppFeedback();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AttendancePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyPlayerId, setBusyPlayerId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [showAllPlayers, setShowAllPlayers] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/trainer/live/attendance?trainingDayId=${trainingDayId}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Anwesenheit konnte nicht geladen werden.");
      setData(payload);
    } catch (error) {
      notify("Anwesenheit nicht verfügbar", { message: error instanceof Error ? error.message : "Unbekannter Fehler", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [notify, trainingDayId]);

  useEffect(() => {
    if (open && !data) void load();
  }, [open, data, load]);

  const participants = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.participants ?? [])
      .filter((player) => showAllPlayers || player.registered)
      .filter((player) => !normalized || player.displayName.toLowerCase().includes(normalized) || player.firstName.toLowerCase().includes(normalized))
      .filter((player) => {
        if (filter === "OPEN") return player.status === "EXPECTED";
        if (filter === "HERE") return player.status === "PRESENT" || player.status === "LATE";
        if (filter === "AWAY") return player.status === "ABSENT" || player.status === "EXCUSED";
        return true;
      })
      .sort((a, b) => {
        const rank: Record<AttendanceStatus, number> = { EXPECTED: 0, LATE: 1, PRESENT: 2, ABSENT: 3, EXCUSED: 4, NOT_REGISTERED: 5 };
        return rank[a.status] - rank[b.status] || a.displayName.localeCompare(b.displayName, "de");
      });
  }, [data, filter, query, showAllPlayers]);

  async function updateStatus(player: Participant, status: AttendanceStatus) {
    setBusyPlayerId(player.id);
    try {
      const response = await fetch("/api/trainer/live/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingDayId, playerId: player.id, status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Status konnte nicht geändert werden.");
      notify(payload.message ?? "Anwesenheit aktualisiert.", { tone: status === "PRESENT" ? "success" : "info" });
      await Promise.all([load(), onChanged()]);
    } catch (error) {
      notify("Status nicht geändert", { message: error instanceof Error ? error.message : "Unbekannter Fehler", tone: "error" });
    } finally {
      setBusyPlayerId(null);
    }
  }

  async function markAllPresent() {
    setBulkBusy(true);
    try {
      const response = await fetch("/api/trainer/live/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingDayId, action: "mark_registered_present" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Sammel-Check-in fehlgeschlagen.");
      notify(payload.message ?? "Alle Spieler eingecheckt.", { tone: "success" });
      await Promise.all([load(), onChanged()]);
    } catch (error) {
      notify("Check-in fehlgeschlagen", { message: error instanceof Error ? error.message : "Unbekannter Fehler", tone: "error" });
    } finally {
      setBulkBusy(false);
    }
  }

  const summary = data?.summary;

  return (
    <section className={`phase6-attendance ${open ? "is-open" : ""}`}>
      <button className="phase6-attendance-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <div><span>ANWESENHEIT</span><strong>Check-in & Teilnehmer</strong><small>{summary ? `${summary.present + summary.late} von ${summary.total} vor Ort` : "Spielerstatus verwalten"}</small></div>
        <div className="phase6-attendance-toggle-stats"><b>{summary?.present ?? "–"}</b><span>da</span><i>{open ? "−" : "+"}</i></div>
      </button>

      {open && (
        <div className="phase6-attendance-body">
          <header className="phase6-attendance-summary">
            <article className="is-present"><span>Anwesend</span><strong>{summary?.present ?? 0}</strong></article>
            <article className="is-late"><span>Verspätet</span><strong>{summary?.late ?? 0}</strong></article>
            <article className="is-open"><span>Offen</span><strong>{summary?.expected ?? 0}</strong></article>
            <article className="is-absent"><span>Abwesend</span><strong>{summary?.absent ?? 0}</strong></article>
            <article className="is-excused"><span>Entschuldigt</span><strong>{summary?.excused ?? 0}</strong></article>
          </header>

          <div className="phase6-attendance-tools">
            <label><span>Spieler suchen</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Dartname oder Vorname" /></label>
            <div className="phase6-attendance-filters">
              {(["ALL", "OPEN", "HERE", "AWAY"] as Filter[]).map((item) => <button type="button" className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)} key={item}>{item === "ALL" ? "Alle" : item === "OPEN" ? "Offen" : item === "HERE" ? "Vor Ort" : "Fehlt"}</button>)}
            </div>
            <button type="button" className="phase6-attendance-all" onClick={() => setShowAllPlayers((value) => !value)}>{showAllPlayers ? "Nur eingeplante" : "Alle Vereins-Spieler"}</button>
            <button type="button" className="phase6-attendance-bulk" disabled={bulkBusy || !summary?.total} onClick={() => void markAllPresent()}>{bulkBusy ? "Check-in läuft …" : "Alle eingecheckt"}</button>
          </div>

          {loading && <div className="phase6-attendance-loading"><i /><i /><i /></div>}

          {!loading && (
            <div className="phase6-attendance-list">
              {participants.map((player) => (
                <article className={`status-${player.status.toLowerCase().replace("_", "-")}`} key={player.id} aria-busy={busyPlayerId === player.id}>
                  <div className="phase6-attendance-person">
                    <i>{player.displayName.slice(0, 1).toUpperCase()}</i>
                    <div><strong>{player.displayName}</strong><span>{player.board?.name ?? (player.registered ? "Spielerbank / noch nicht zugewiesen" : "Nicht für den Trainingstag eingeplant")}</span></div>
                  </div>
                  <em>{STATUS_COPY[player.status].label}{player.checkedInAt && <small>{new Date(player.checkedInAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</small>}</em>
                  <div className="phase6-attendance-actions">
                    {!player.registered && <button type="button" disabled={busyPlayerId !== null} onClick={() => void updateStatus(player, "PRESENT")}>Einchecken</button>}
                    {player.registered && <>
                      <button type="button" className={player.status === "PRESENT" ? "is-active is-present" : ""} disabled={busyPlayerId !== null} onClick={() => void updateStatus(player, "PRESENT")}>Da</button>
                      <button type="button" className={player.status === "LATE" ? "is-active is-late" : ""} disabled={busyPlayerId !== null} onClick={() => void updateStatus(player, "LATE")}>Spät</button>
                      <button type="button" className={player.status === "ABSENT" ? "is-active is-absent" : ""} disabled={busyPlayerId !== null} onClick={() => void updateStatus(player, "ABSENT")}>Fehlt</button>
                      <button type="button" className={player.status === "EXCUSED" ? "is-active is-excused" : ""} disabled={busyPlayerId !== null} onClick={() => void updateStatus(player, "EXCUSED")}>Entschuldigt</button>
                    </>}
                  </div>
                </article>
              ))}
              {participants.length === 0 && <p className="phase6-attendance-empty">Keine Spieler für diesen Filter gefunden.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
