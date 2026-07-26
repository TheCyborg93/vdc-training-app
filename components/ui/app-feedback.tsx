"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type ToastTone = "success" | "info" | "warning" | "error";
type Toast = { id: number; title: string; message?: string; tone: ToastTone };
type ConfirmOptions = { title: string; message: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };
type FeedbackContextValue = {
  notify: (title: string, options?: { message?: string; tone?: ToastTone }) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function inferTone(text: string): ToastTone {
  const value = text.toLowerCase();
  if (value.includes("fehl") || value.includes("nicht erreichbar") || value.includes("ungültig")) return "error";
  if (value.includes("warn") || value.includes("fehlt") || value.includes("zu lang")) return "warning";
  if (value.includes("gespeichert") || value.includes("erstellt") || value.includes("aktualisiert") || value.includes("gelöscht") || value.includes("abgeschlossen") || value.includes("fortgesetzt")) return "success";
  return "info";
}

export function AppFeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);
  const lastObservedMessage = useRef("");
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const notify = useCallback((title: string, options?: { message?: string; tone?: ToastTone }) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current.slice(-3), { id, title, message: options?.message, tone: options?.tone ?? "info" }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setDialog({ ...options, resolve });
  }), []);

  const closeDialog = useCallback((value: boolean) => {
    setDialog((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => confirmButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [dialog, closeDialog]);

  useEffect(() => {
    const surfaceMessages = () => {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(".form-message"));
      const latest = elements.map((element) => element.textContent?.trim() ?? "").filter(Boolean).at(-1) ?? "";
      if (!latest || latest === lastObservedMessage.current) return;
      lastObservedMessage.current = latest;
      notify(inferTone(latest) === "error" ? "Aktion fehlgeschlagen" : "Status aktualisiert", { message: latest, tone: inferTone(latest) });
    };

    surfaceMessages();
    const observer = new MutationObserver(surfaceMessages);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [notify]);

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="vdc-toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <article className={`vdc-toast is-${toast.tone}`} key={toast.id} role="status">
            <span aria-hidden="true" />
            <div><strong>{toast.title}</strong>{toast.message ? <p>{toast.message}</p> : null}</div>
            <button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Hinweis schließen">×</button>
          </article>
        ))}
      </div>
      {dialog ? (
        <div className="vdc-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(false); }}>
          <section className="vdc-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="vdc-dialog-title" aria-describedby="vdc-dialog-message">
            <div className={`vdc-dialog-mark ${dialog.destructive ? "is-danger" : ""}`} aria-hidden="true">!</div>
            <div><small>{dialog.destructive ? "Kritische Aktion" : "Bestätigung"}</small><h2 id="vdc-dialog-title">{dialog.title}</h2><p id="vdc-dialog-message">{dialog.message}</p></div>
            <footer>
              <button type="button" className="button secondary" onClick={() => closeDialog(false)}>{dialog.cancelLabel ?? "Abbrechen"}</button>
              <button ref={confirmButtonRef} type="button" className={dialog.destructive ? "button danger" : "button"} onClick={() => closeDialog(true)}>{dialog.confirmLabel ?? "Bestätigen"}</button>
            </footer>
          </section>
        </div>
      ) : null}
    </FeedbackContext.Provider>
  );
}

export function useAppFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useAppFeedback muss innerhalb des AppFeedbackProvider verwendet werden.");
  return context;
}
