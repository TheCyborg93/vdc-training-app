import { NextResponse } from "next/server";
import { GET as getActivity } from "../activity/route";
import { GET as getHistory } from "../history/route";
import { GET as getMilestones } from "../milestones/route";
import { GET as getQuickstart } from "../quickstart/route";
import { GET as getTrends } from "../trends/route";

async function readSection(response: Response, fallback: string) {
  const payload = await response.json();
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : fallback);
  return payload;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const playerId = Number(url.searchParams.get("playerId"));
    if (!Number.isInteger(playerId)) {
      return NextResponse.json({ error: "Spieler fehlt." }, { status: 400 });
    }

    const sectionRequest = (pathname: string) => new Request(new URL(`${pathname}?playerId=${playerId}`, url.origin), {
      headers: request.headers,
      method: "GET",
    });

    const [activityResponse, quickstartResponse, historyResponse, milestonesResponse, trendsResponse] = await Promise.all([
      getActivity(sectionRequest("/api/home-training/activity")),
      getQuickstart(sectionRequest("/api/home-training/quickstart")),
      getHistory(sectionRequest("/api/home-training/history")),
      getMilestones(sectionRequest("/api/home-training/milestones")),
      getTrends(sectionRequest("/api/home-training/trends")),
    ]);

    const [activity, quickstart, history, milestones, trends] = await Promise.all([
      readSection(activityResponse, "Aktivität konnte nicht geladen werden."),
      readSection(quickstartResponse, "Schnellstart konnte nicht geladen werden."),
      readSection(historyResponse, "Historie konnte nicht geladen werden."),
      readSection(milestonesResponse, "Meilensteine konnten nicht geladen werden."),
      readSection(trendsResponse, "Trends konnten nicht geladen werden."),
    ]);

    return NextResponse.json(
      { playerId, activity, quickstart, history, milestones, trends, generatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=45" } },
    );
  } catch (error) {
    console.error("Home insights GET failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Spielerdaten konnten nicht geladen werden." }, { status: 500 });
  }
}
