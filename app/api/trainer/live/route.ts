import { NextResponse } from "next/server";
import { getLiveTrainingSnapshot } from "@/lib/live-training/service";

export const preferredRegion = "lhr1";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const requestedTrainingId = Number(new URL(request.url).searchParams.get("trainingId"));
    const trainingId = Number.isInteger(requestedTrainingId) && requestedTrainingId > 0
      ? requestedTrainingId
      : undefined;
    const snapshot = await getLiveTrainingSnapshot(trainingId);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Trainer live GET failed", error);
    return NextResponse.json({ error: "Live-Training konnte nicht geladen werden." }, { status: 500 });
  }
}
