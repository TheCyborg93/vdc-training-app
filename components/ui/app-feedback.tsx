"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastTone = "success" | "info" | "warning" | "error";
type Toast = { id: number; title: string; message?: string; tone: ToastTone };
type ConfirmOptions = { title: string; message: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };
type FeedbackContextValue = {
  notify: (title: string, options?: { message?: string; tone?: ToastTone }) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function AppFeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);

  const notify = useCallback((title: string, options?: { message?: string; tone?: ToastTone }) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, title, message: options?.message, tone: options?.tone ?? "info" }]);
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

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="vdc-toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <article className={`vdc-toast is-${toast.tone}`} key={toast.id}>
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
              <button type="button" className={dialog.destructive ? "button danger" : "button"} onClick={() => closeDialog(true)}>{dialog.confirmLabel ?? "Bestätigen"}</button>
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
