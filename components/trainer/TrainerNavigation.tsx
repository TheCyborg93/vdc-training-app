"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups = [
  {
    label: "Training",
    items: [
      { href: "/trainer", code: "DB", title: "Dashboard", description: "Trainer Cockpit" },
      { href: "/trainer/live", code: "LV", title: "Live Center", description: "Training steuern" },
      { href: "/trainer/trainingstag", code: "TG", title: "Trainingstag", description: "Spieler & Boards" },
      { href: "/trainer/trainingsplaene", code: "PL", title: "Trainingspläne", description: "Pläne erstellen" },
      { href: "/trainer/uebungen", code: "ÜB", title: "Übungen", description: "Katalog & Engines" },
    ],
  },
  {
    label: "Analyse & Historie",
    items: [
      { href: "/trainer/spieler", code: "SP", title: "Spieler", description: "Profile & Entwicklung" },
      { href: "/trainer/spieler/vergleich", code: "VG", title: "Vereinsvergleich", description: "Spieler vergleichen" },
      { href: "/trainer/statistiken", code: "ST", title: "Statistiken", description: "Leistungsanalyse" },
      { href: "/trainer/archiv", code: "HI", title: "Trainingshistorie", description: "Verein & Zuhause" },
      { href: "/trainer/archiv/vergleich", code: "2X", title: "Einheitenvergleich", description: "Trainings vergleichen" },
    ],
  },
  {
    label: "Coach",
    items: [
      { href: "/trainer/ai-coach", code: "AI", title: "Coach Analyse", description: "Fokus & Empfehlungen" },
      { href: "/trainer/ai-coach/adaptive", code: "AD", title: "Adaptive Planung", description: "Individueller KI-Plan" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/trainer") return pathname === href;
  if (href === "/trainer/spieler") return pathname === href || (pathname.startsWith(`${href}/`) && !pathname.startsWith("/trainer/spieler/vergleich"));
  if (href === "/trainer/archiv") return pathname === href || (pathname.startsWith(`${href}/`) && !pathname.startsWith("/trainer/archiv/vergleich"));
  if (href === "/trainer/ai-coach") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function TrainerNavigation() {
  const pathname = usePathname();

  // Vollbild-Board/Engine-Ansichten sollen frei von globaler Navigation bleiben.
  if (pathname.startsWith("/trainer/live/board") || pathname.includes("/engine")) return null;

  return (
    <nav className="vdc-trainer-nav" aria-label="Trainer Navigation">
      <div className="vdc-trainer-nav__brand">
        <Link href="/trainer">
          <span>VDC</span>
          <div><strong>Training Center</strong><small>Trainer Bereich</small></div>
        </Link>
      </div>
      <div className="vdc-trainer-nav__groups">
        {groups.map((group) => (
          <section key={group.label} className="vdc-trainer-nav__group">
            <span className="vdc-trainer-nav__label">{group.label}</span>
            <div className="vdc-trainer-nav__items">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link key={item.href} href={item.href} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}>
                    <b>{item.code}</b>
                    <span><strong>{item.title}</strong><small>{item.description}</small></span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </nav>
  );
}
