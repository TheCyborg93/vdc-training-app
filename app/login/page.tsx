import Link from "next/link";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="eyebrow">Geschützter Trainerbereich</div>
        <h1>Willkommen zurück.</h1>
        <p>
          Melde dich an, um Trainingstage, Spieler, Boards, Übungen und
          Trainingspläne zu verwalten.
        </p>
        <LoginForm />
        <Link className="text-link" href="/">
          Zurück zur Startseite
        </Link>
      </section>

      <aside className="auth-visual">
        <span className="visual-number">01</span>
        <h2>Planen. Verteilen. Trainieren.</h2>
        <p>
          Eine zentrale Plattform für strukturiertes Vereinstraining – auf jedem
          Gerät und direkt am Board.
        </p>
        <div className="visual-lines" aria-hidden="true" />
      </aside>
    </main>
  );
}
