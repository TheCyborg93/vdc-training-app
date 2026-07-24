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

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: "Der Server hat keine gültige Antwort geliefert." };
  }
}

async function requestWithTimeout(url: string, options?: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
  } finally {
    window.clearTimeout(timer);
  }
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  async function loadPlayers() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await requestWithTimeout("/api/players");
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error ?? "Spieler konnten nicht geladen werden.");
      setPlayers(Array.isArray(data) ? data : []);
    } catch (error) {
      const text = error instanceof DOMException && error.name === "AbortError"
        ? "Die Anfrage hat zu lange gedauert. Bitte prüfe die Datenbankverbindung in Vercel."
        : error instanceof Error ? error.message : "Spieler konnten nicht geladen werden.";
      setLoadError(text);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPlayers(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");

    try {
      const url = editingId ? `/api/players/${editingId}` : "/api/players";
      const response = await requestWithTimeout(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      }

      setMessage(editingId ? "Spieler aktualisiert." : "Spieler hinzugefügt.");
      setForm(emptyForm);
      setEditingId(null);
      await loadPlayers();
    } catch (error) {
      const text = error instanceof DOMException && error.name === "AbortError"
        ? "Das Speichern hat zu lange gedauert. Bitte prüfe die Vercel-Datenbankvariablen."
        : error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
      setMessage(text);
    } finally {
      setSaving(false);
    }
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
    setMessage("");
    try {
      const response = await requestWithTimeout(`/api/players/${player.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !player.active })
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error ?? "Status konnte nicht geändert werden.");
      await loadPlayers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Status konnte nicht geändert werden.");
    }
  }

  async function remove(player: Player) {
    if (!window.confirm(`${player.displayName} wirklich entfernen?`)) return;
    setMessage("");
    try {
      const response = await requestWithTimeout(`/api/players/${player.id}`, { method: "DELETE" });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error ?? "Spieler konnte nicht entfernt werden.");
      setMessage(data.deactivated ? "Spieler hatte Trainingsdaten und wurde deshalb deaktiviert." : "Spieler entfernt.");
      await loadPlayers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Spieler konnte nicht entfernt werden.");
    }
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
          {loading ? <div className="card"><p>Spieler werden geladen …</p></div> : loadError ? (
            <div className="card">
              <p className="form-message">{loadError}</p>
              <button className="button secondary" type="button" onClick={() => void loadPlayers()}>Erneut versuchen</button>
            </div>
          ) : players.length === 0 ? <div className="card"><p>Noch keine Spieler angelegt.</p></div> : (
            <div className="player-list">
              {players.map((player) => (
                <article className={`player-admin-card ${player.active ? "" : "is-inactive"}`} key={player.id}>
                  <div className="player-avatar">{player.displayName.slice(0, 2).toUpperCase()}</div>
                  <div className="player-main">
                    <div className="player-title-row"><strong>{player.displayName}</strong><span className={player.active ? "status" : "status status-muted"}>{player.active ? "Aktiv" : "Inaktiv"}</span></div>
                    <p>{player.firstName} {player.lastName}{player.skillLevel ? ` · Stufe ${player.skillLevel}` : ""}</p>
                  </div>
                  <div className="player-actions">
                    <button type="button" onClick={() => edit(player)}>Bearbeiten</button>
                    <button type="button" onClick={() => void toggleActive(player)}>{player.active ? "Deaktivieren" : "Aktivieren"}</button>
                    <button type="button" className="danger-link" onClick={() => void remove(player)}>Entfernen</button>
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
