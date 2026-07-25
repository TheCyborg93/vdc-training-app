import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedTrainer = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  supabaseUserId: string;
};

export async function getAuthenticatedTrainer(): Promise<AuthenticatedTrainer | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) return null;

  const trainer = await prisma.user.findUnique({
    where: { email: user.email.toLowerCase() },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  if (!trainer?.active || (trainer.role !== "TRAINER" && trainer.role !== "ADMIN")) {
    return null;
  }

  return {
    id: trainer.id,
    name: trainer.name,
    email: trainer.email,
    role: trainer.role,
    supabaseUserId: user.id,
  };
}
