import { NextResponse } from "next/server";
import { getAuthenticatedTrainer } from "@/lib/auth/trainer";

export const dynamic = "force-dynamic";

export async function GET() {
  const trainer = await getAuthenticatedTrainer();

  if (!trainer) {
    return NextResponse.json(
      { authenticated: false, trainer: null },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      trainer: {
        name: trainer.name,
        role: trainer.role,
      },
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
