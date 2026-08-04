# Phase 6 – abgeschlossen

Phase 6 der VDC Training App ist technisch abgeschlossen.

## Abnahmekriterien

- Produktions-Build auf Vercel erfolgreich
- Service- und Repository-Schicht für zentrale Trainingsabläufe
- DTOs und Zod-Validierung für refaktorierte APIs
- Persistenter Event Store mit Retry und Dead Letter
- Persistente Live-Feed-, Audit- und Benachrichtigungsprojektionen
- Supabase Realtime für Live Center, Coach View und Benachrichtigungen
- Datenbankgestützte Background-Job-Queue mit Cron-Worker
- Health- und Monitoring-Grundlage
- Catch-40-Engine mit 6 Darts für Ziele 40–90 und 9 Darts ab 91
- Einheitliche Engine-Registry
- Nullaufnahmen werden als reguläre Aufnahmen gespeichert
- Geschützter Engine-Vertragstest unter `/api/admin/phase-6/audit`

## Geprüfte Nullaufnahmen

- 0 Treffer bei Ziel-, Doppel-, Bull- und Around-the-Clock-Übungen
- 0 Punkte bei Scoring, X01, zeitbasierten Scoreübungen und Catch 40
- 0 Single / 0 Doppel / 0 Treble bei Segmentübungen
- nicht geschaffter Checkout als vollständiger Versuch
- 0 Marken / 0 Punkte bei Cricket
- 0 Lebensänderung bei Killer
- numerische 0 bei freien Übungen

## Datenbankmigrationen

Vor dem produktiven Einsatz müssen alle Prisma-Migrationen ausgeführt sein:

```bash
npx prisma migrate deploy
```

Dazu gehört insbesondere die Migration für `CATCH_40`.

## Übergang zu Phase 7

Phase 7 beginnt mit dem Analyse- und Coach-System. Die technische Grundlage aus Phase 6 bleibt stabil und wird über Events, Jobs, DTOs und Realtime erweitert.
