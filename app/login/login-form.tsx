"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setMessage("Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
        return;
      }

      router.push("/trainer");
      router.refresh();
    } catch {
      setMessage("Die Anmeldung konnte nicht gestartet werden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label>
        E-Mail-Adresse
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="trainer@verein.de"
          autoComplete="email"
          required
        />
      </label>

      <label>
        Passwort
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </label>

      {message ? <p className="form-message">{message}</p> : null}

      <button className="button full" type="submit" disabled={loading}>
        {loading ? "Anmeldung läuft …" : "Anmelden"}
      </button>
    </form>
  );
}
