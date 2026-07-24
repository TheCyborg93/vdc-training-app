"use client";

import { FormEvent, useEffect, useState } from "react";

type Board = {
  id: number;
  name: string;
  location: string | null;
  active: boolean;
  available: boolean;
};

const emptyForm = { name: "", location: "" };

async function fetchJson(input: RequestInfo, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Anfrage fehlgeschlagen.");
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadBoards() {
    setLoading(true);
    try {
      const data = await fetchJson("/api/boards", { cache: "no-store" });
      setBoards(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Boards konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadBoards(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await fetchJson(editingId ? `/api/boards/${editingId}` : "/api/boards", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      setMessage(editingId ? "Board aktualisiert." : "Board hinzugefügt.");
      setForm(emptyForm);
      setEditingId(null);
      await loadBoards();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  function edit(board: Board) {
    setEditingId(board.id);
    setForm({ name: board.name, location: board.location ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function patch(board: Board, values: Partial<Board>) {
    setMessage("");
    try {
      await fetchJson(`/api/boards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      await loadBoards();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Änderung fehlgeschlagen.");
    }
  }

  async function remove(board: Board) {
    if (!window.confirm(`${board.name} wirklich entfernen?`)) return;
    try {
      const data = await fetchJson(`/api/boards/${board.id}`, { method: "DELETE" });
      setMessage(data.deactivated ? "Board wird bereits verwendet und wurde deaktiviert." : "Board entfernt.");
      await loadBoards();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Entfernen fehlgeschlagen.");
    }
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-heading">
        <div>
          <div className="eyebrow">Trainerbereich</div>
          <h1>Boardverwaltung</h1>
          <p>Boards anlegen und ihre Verfügbarkeit für Trainingstage steuern.</p>
        </div>
      </section>

      <section className="player-admin-layout">
        <form className="admin-form card" onSubmit={submit}>
          <div className="section-heading"><div><span className="eyebrow">{editingId ? "Bearbeiten" : "Neu"}</span><h2>{editingId ? "Board ändern" : "Board hinzufügen"}</h2></div></div>
          <label>Boardname<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="z. B. Board 1" required /></label>
          <label>Standort oder Bereich<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="z. B. Hauptraum links" /></label>
          <div className="actions">
            <button className="button" disabled={saving}>{saving ? "Speichert …" : editingId ? "Änderungen speichern" : "Board hinzufügen"}</button>
            {editingId && <button className="button secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Abbrechen</button>}
          </div>
          {message && <p className="form-message">{message}</p>}
        </form>

        <section>
          <div className="section-heading"><div><span className="eyebrow">Übersicht</span><h2>{boards.length} Boards</h2></div></div>
          {loading ? <div className="card"><p>Boards werden geladen …</p></div> : boards.length === 0 ? <div className="card"><p>Noch keine Boards angelegt.</p></div> : (
            <div className="player-list">
              {boards.map((board) => (
                <article className={`player-admin-card ${board.active ? "" : "is-inactive"}`} key={board.id}>
                  <div className="player-avatar">{board.name.replace(/[^0-9A-Za-z]/g, "").slice(0, 2).toUpperCase() || "B"}</div>
                  <div className="player-main">
                    <div className="player-title-row">
                      <strong>{board.name}</strong>
                      <span className={board.available && board.active ? "status" : "status status-muted"}>{!board.active ? "Inaktiv" : board.available ? "Verfügbar" : "Belegt"}</span>
                    </div>
                    <p>{board.location || "Kein Standort hinterlegt"}</p>
                  </div>
                  <div className="player-actions">
                    <button onClick={() => edit(board)}>Bearbeiten</button>
                    <button onClick={() => void patch(board, { available: !board.available })}>{board.available ? "Nicht verfügbar" : "Verfügbar setzen"}</button>
                    <button onClick={() => void patch(board, { active: !board.active, ...(board.active ? { available: false } : {}) })}>{board.active ? "Deaktivieren" : "Aktivieren"}</button>
                    <button className="danger-link" onClick={() => void remove(board)}>Entfernen</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
