"use client";

import { useEffect } from "react";

const IMPOSSIBLE_THREE_DART_SCORES = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);
const ENGINE_SELECTOR = ".engine-v4, .training-engine-pro";
const SCORE_INPUT_SELECTOR = `${ENGINE_SELECTOR} .engine-score-entry input`;

function ensureGuidance(entry: HTMLElement) {
  let guidance = entry.querySelector<HTMLElement>(":scope > .engine-score-guidance");
  if (!guidance) {
    guidance = document.createElement("div");
    guidance.className = "engine-score-guidance";
    guidance.setAttribute("role", "status");
    guidance.setAttribute("aria-live", "polite");
    entry.appendChild(guidance);
  }
  return guidance;
}

function enhanceScoreInput(input: HTMLInputElement) {
  const engine = input.closest<HTMLElement>(ENGINE_SELECTOR);
  const entry = input.closest<HTMLElement>(".engine-score-entry");
  if (!engine || !entry) return;

  const guidance = ensureGuidance(entry);
  const raw = input.value.trim();
  const value = raw === "" ? null : Number(raw);
  const invalidRange = value !== null && (!Number.isInteger(value) || value < 0 || value > 180);
  const impossible = value !== null && IMPOSSIBLE_THREE_DART_SCORES.has(value);
  const invalid = invalidRange || impossible;

  entry.classList.toggle("is-invalid", invalid);
  input.setAttribute("aria-invalid", invalid ? "true" : "false");

  const submit = engine.querySelector<HTMLButtonElement>(".engine-v4-submit");
  if (submit) {
    if (invalid) {
      submit.dataset.engineGuardDisabled = "true";
      submit.disabled = true;
    } else if (submit.dataset.engineGuardDisabled === "true") {
      delete submit.dataset.engineGuardDisabled;
      if (raw !== "" && !engine.classList.contains("is-submitting")) submit.disabled = false;
    }
  }

  if (invalidRange) {
    guidance.className = "engine-score-guidance is-error";
    guidance.textContent = "Bitte einen ganzen Score zwischen 0 und 180 eingeben.";
    return;
  }

  if (impossible) {
    guidance.className = "engine-score-guidance is-error";
    guidance.textContent = `${value} ist mit drei Darts nicht möglich.`;
    return;
  }

  const engineKind = engine.dataset.engineKind ?? "";
  const legacyTitle = engine.querySelector<HTMLElement>(".engine-kicker")?.textContent ?? "";
  const scoreText = engine.querySelector<HTMLElement>(".training-engine-metric.is-score strong")?.textContent ?? "";
  const targetText = engine.querySelector<HTMLElement>(".training-engine-metric.is-target")?.textContent ?? legacyTitle;
  const currentRest = Number(scoreText.replace(/[^0-9]/g, ""));
  const isX01 = /X01/i.test(engineKind) || /^\d+\s+Rest/i.test(legacyTitle);

  if (value !== null && isX01 && Number.isFinite(currentRest)) {
    const nextRest = currentRest - value;
    const requiresDouble = /DOUBLE\s+Out/i.test(targetText);
    const requiresMaster = /MASTER\s+Out/i.test(targetText);
    const checkoutSelected = Boolean(engine.querySelector(".engine-segmented .is-active:not(:first-child)"));

    if (nextRest < 0 || ((requiresDouble || requiresMaster) && nextRest === 1)) {
      guidance.className = "engine-score-guidance is-warning";
      guidance.textContent = "Bust: Der vorherige Rest bleibt bestehen.";
      return;
    }

    if (nextRest === 0 && !checkoutSelected) {
      guidance.className = "engine-score-guidance is-warning";
      guidance.textContent = "Score ergibt 0. Bitte die passende Checkout-Art auswählen.";
      return;
    }

    guidance.className = "engine-score-guidance is-preview";
    guidance.textContent = `Voraussichtlicher Rest: ${Math.max(0, nextRest)}`;
    return;
  }

  if (value !== null) {
    guidance.className = "engine-score-guidance is-valid";
    guidance.textContent = `${value} Punkte sind bereit zum Speichern.`;
    return;
  }

  guidance.className = "engine-score-guidance";
  guidance.textContent = "Score eingeben oder einen Schnellwert wählen.";
}

function enhanceAll(root: ParentNode = document) {
  root.querySelectorAll<HTMLInputElement>(SCORE_INPUT_SELECTOR).forEach(enhanceScoreInput);
}

export default function EngineV4Guard() {
  useEffect(() => {
    const onInput = (event: Event) => {
      const input = event.target instanceof HTMLInputElement ? event.target : null;
      if (input?.matches(SCORE_INPUT_SELECTOR)) enhanceScoreInput(input);
    };

    const onClick = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const engine = target?.closest<HTMLElement>(ENGINE_SELECTOR);
      if (!engine) return;
      window.requestAnimationFrame(() => enhanceAll(engine));
    };

    enhanceAll();
    document.addEventListener("input", onInput);
    document.addEventListener("change", onInput);
    document.addEventListener("click", onClick);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) enhanceAll(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.removeEventListener("input", onInput);
      document.removeEventListener("change", onInput);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
