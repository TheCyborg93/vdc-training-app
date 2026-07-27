import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";
import "../vdc-phase6-dashboard.css";

export const dynamic = "force-dynamic";

export default async function TrainerLayout({ children }: { children: ReactNode }) {
  const trainer = await getAuthenticatedTrainer();

  if (!trainer) {
    redirect("/login?error=trainer-session");
  }

  return children;
}
