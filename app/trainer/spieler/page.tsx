"use client";

import { FormEvent, useEffect, useState } from "react";

type Player = {
  id: number;
  firstName: string;
  lastName: string;
  displayName: string;
  skillLevel: number | null;
  active: boolean;
};

const emptyForm = { firstName: "", lastName: "", displayName: "", skillLevel: "" };

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadPlayers() {
    setLoading(true);
    const response = await fetch("/api/players", { cache: "no-store" });
    const data = await response.json();
    setPlayers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { void loadPlayers(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const url = editingId ? `/api/players/${editingId}` : "/api/players";
    const response = await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    if (!response.ok) setMessage(data.error ?? "Speichern fehlgeschlagen.");
    else {
      setMessage(editingId ? "Spieler aktualisiert." : "Spieler hinzugefügt.");
      setForm(emptyForm);
      setEditingId(null);
      await loadPlayers();
    }
    setSaving(false);
  }

  function edit(player: Player) {
    setEditingId(player.id);
    setForm({
      firstName: player.firstName,
      lastName: player.lastName,
      displayName: player.displayName,
      skillLevel: player.skillLevel?.toString() ?? ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleActive(player: Player) {
    await fetch(`/api/players/${player.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !player.active })
    });
    await loadPlayers();
  }

  async function remove(player: Player) {
    if (!window.confirm(`${player.displayName} wirklich entfernen?`)) return;
    const response = await fetch(`/api/players/${player.id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(data.deactivated ? "Spieler hatte Trainingsdaten und wurde deshalb deaktiviert." : "Spieler entfernt.");
    await loadPlayers();
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-heading">
        <div>
          <div className="eyebrow">Trainerbereich</div>
          <h1>Spielerverwaltung</h1>
          <p>Spieler anlegen, bearbeiten und für Trainings aktivieren.</p>
        </div>
      </section>

      <section className="player-admin-layout">
        <form className="admin-form card" onSubmit={submit}>
          <div className="section-heading"><div><span className="eyebrow">{editingId ? "Bearbeiten" : "Neu"}</span><h2>{editingId ? "Spieler ändern" : "Spieler hinzufügen"}</h2></div></div>
          <label>Vorname<input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></label>
          <label>Nachname<input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></label>
          <label>Anzeigename<input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="z. B. TheCyborg" required /></label>
          <label>Leistungsstufe (1–10)<input type="number" min="1" max="10" value={form.skillLevel} onChange={(event) => setForm({ ...form, skillLevel: event.target.value })} /></label>
          <div className="actions">
            <button className="button" disabled={saving}>{saving ? "Speichert …" : editingId ? "Änderungen speichern" : "Spieler hinzufügen"}</button>
            {editingId && <button className="button secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Abbrechen</button>}
          </div>
          {message && <p className="form-message">{message}</p>}
        </form>

        <section>
          <div className="section-heading"><div><span className="eyebrow">Übersicht</span><h2>{players.length} Spieler</h2></div></div>
          {loading ? <div className="card"><p>Spieler werden geladen …</p></div> : players.length === 0 ? <div className="card"><p>Noch keine Spieler angelegt.</p></div> : (
            <div className="player-list">
              {players.map((player) => (
                <article className={`player-admin-card ${player.active ? "" : "is-inactive"}`} key={player.id}>
                  <div className="player-avatar">{player.displayName.slice(0, 2).toUpperCase()}</div>
                  <div className="player-main">
                    <div className="player-title-row"><strong>{player.displayName}</strong><span className={player.active ? "status" : "status status-muted"}>{player.active ? "Aktiv" : "Inaktiv"}</span></div>
                    <p>{player.firstName} {player.lastName}{player.skillLevel ? ` · Stufe ${player.skillLevel}` : ""}</p>
                  </div>
                  <div className="player-actions">
                    <button onClick={() => edit(player)}>Bearbeiten</button>
                    <button onClick={() => void toggleActive(player)}>{player.active ? "Deaktivieren" : "Aktivieren"}</button>
                    <button className="danger-link" onClick={() => void remove(player)}>Entfernen</button>
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
