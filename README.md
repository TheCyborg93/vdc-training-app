# VDC Training App

Trainings-Webapp des Vestischen Dartclubs.

## Technik

- Next.js 15 mit TypeScript
- React 19
- Prisma ORM
- Supabase PostgreSQL
- Responsive Oberfläche für Smartphone, Tablet und Desktop

## Lokaler Start

1. Repository klonen.
2. Abhängigkeiten installieren: `npm install`
3. `.env.example` nach `.env` kopieren und die Supabase-Werte eintragen.
4. Prisma Client erzeugen: `npm run prisma:generate`
5. Datenbankmigration ausführen: `npx prisma migrate dev --name init`
6. App starten: `npm run dev`

Die App läuft anschließend unter `http://localhost:3000`.

## Erforderliche Umgebungsvariablen

- `DATABASE_URL`: gepoolte Supabase-Verbindung für die App
- `DIRECT_URL`: direkte oder Session-Pooler-Verbindung für Prisma-Migrationen
- `NEXT_PUBLIC_SUPABASE_URL`: öffentliche Supabase-Projekt-URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: öffentlicher Supabase-Anon-Key

Geheime Zugangsdaten gehören niemals ins Repository.
