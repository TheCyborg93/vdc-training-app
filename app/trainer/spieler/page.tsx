"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAppFeedback } from "@/components/ui/app-feedback";

type Player = {
  id: number;
  firstName: string;
  displayName: string;
  active: boolean;
  createdAt?: string;
  _count?: { results: number; homeResults: number; trainingDayPlayers: number };
};

const emptyForm = { firstName: "", dartName: "" };

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: "Der Server hat keine gültige Antwort geliefert." }; }
}

export default function PlayersPage() {
  const { confirm, notify } = useAppFeedback();
  const [players, setPlayers] = useState<Player[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  async function loadPlayers() {
    setLoading(true);
    try {
      const response = await fetch("/api/players", { cache: "no-store" });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error ?? "Spieler konnten nicht geladen werden.");
      setPlayers(Array.isArray(data) ? data : []);
    } catch (error) {
      notify("Laden fehlgeschlagen", { message: error instanceof Error ? error.message : "Unbekannter Fehler.", tone: "error" });
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadPlayers(); }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return players;
    return players.filter((player) => `${player.firstName} ${player.displayName}`.toLowerCase().includes(value));
  }, [players, query]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/players/${editingId}` : "/api/players", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      notify(editingId ? "Spieler aktualisiert" : "Spieler angelegt", { message: `${form.dartName} wurde gespeichert.`, tone: "success" });
      setEditingId(null); setForm(emptyForm); await loadPlayers();
    } catch (error) {
      notify("Speichern fehlgeschlagen", { message: error instanceof Error ? error.message : "Unbekannter Fehler.", tone: "error" });
    } finally { setSaving(false); }
  }

  function edit(player: Player) {
    setEditingId(player.id);
    setForm({ firstName: player.firstName, dartName: player.displayName });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleActive(player: Player) {
    const response = await fetch(`/api/players/${player.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !player.active }),
    });
    const data = await readJson(response);
    if (!response.ok) return notify("Status nicht geändert", { message: data.error ?? "Unbekannter Fehler.", tone: "error" });
    await loadPlayers();
  }

  async function remove(player: Player) {
    const accepted = await confirm({
      title: `${player.displayName} entfernen?`,
      message: "Vorhandene Trainingsdaten bleiben erhalten. In diesem Fall wird der Spieler nur deaktiviert.",
      confirmLabel: "Entfernen", cancelLabel: "Abbrechen", destructive: true,
    });
    if (!accepted) return;
    const response = await fetch(`/api/players/${player.id}`, { method: "DELETE" });
    const data = await readJson(response);
    if (!response.ok) return notify("Entfernen fehlgeschlagen", { message: data.error ?? "Unbekannter Fehler.", tone: "error" });
    notify(data.deactivated ? "Spieler deaktiviert" : "Spieler entfernt", { message: "Die Änderung wurde übernommen.", tone: "success" });
    await loadPlayers();
  }

  return (
    <main className="dashboard-page player-v3-page">
      <section className="dashboard-heading">
        <div><div className="eyebrow">Digitaler Dart-Zwilling</div><h1>Spieler</h1><p>Nur Vorname und Dartname werden gepflegt. Leistung, Form und Empfehlungen entstehen automatisch aus dem Training.</p></div>
        <Link className="button secondary" href="/trainer/ai-coach">AI Coach öffnen</Link>
      </section>

      <section className="player-admin-layout">
        <form className="admin-form card" onSubmit={submit}>
          <div className="section-heading"><div><span className="eyebrow">{editingId ? "Profil bearbeiten" : "Neues Profil"}</span><h2>{editingId ? "Spieler ändern" : "Spieler hinzufügen"}</h2></div></div>
          <label>Vorname<input autoComplete="given-name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} placeholder="Marvin" required /></label>
          <label>Dartname<input value={form.dartName} onChange={(event) => setForm({ ...form, dartName: event.target.value })} placeholder="TheCyborg" required /></label>
          <p className="form-hint">Skill-Level, Stärken, Schwächen und Formkurve werden nicht manuell gepflegt.</p>
          <div className="actions"><button className="button" disabled={saving}>{saving ? "Speichert …" : editingId ? "Änderungen speichern" : "Spieler hinzufügen"}</button>{editingId && <button className="button secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Abbrechen</button>}</div>
        </form>

        <section>
          <div className="section-heading"><div><span className="eyebrow">Vereinskader</span><h2>{players.filter((player) => player.active).length} aktive Spieler</h2></div></div>
          <label className="player-search">Spieler suchen<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Vorname oder Dartname" /></label>
          {loading ? <div className="card"><p>Spieler werden geladen …</p></div> : filtered.length === 0 ? <div className="card"><p>Keine passenden Spieler gefunden.</p></div> : (
            <div className="player-list">
              {filtered.map((player) => {
                const results = (player._count?.results ?? 0) + (player._count?.homeResults ?? 0);
                return <article className={`player-admin-card ${player.active ? "" : "is-inactive"}`} key={player.id}>
                  <div className="player-avatar">{player.displayName.slice(0, 2).toUpperCase()}</div>
                  <div className="player-main"><div className="player-title-row"><strong>{player.displayName}</strong><span className={player.active ? "status" : "status status-muted"}>{player.active ? "Aktiv" : "Inaktiv"}</span></div><p>{player.firstName} · {results} gespeicherte Aufnahmen</p></div>
                  <div className="player-actions"><Link href={`/trainer/spieler/${player.id}`}>Profil</Link><button type="button" onClick={() => edit(player)}>Bearbeiten</button><button type="button" onClick={() => void toggleActive(player)}>{player.active ? "Deaktivieren" : "Aktivieren"}</button><button type="button" className="danger-link" onClick={() => void remove(player)}>Entfernen</button></div>
                </article>;
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
