import { NextResponse } from "next/server";
import { addScore, getTopScores, validateInitials, validateInt } from "@/lib/scores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const scores = await getTopScores(20);
    return NextResponse.json(scores);
  } catch (err) {
    const message = err instanceof Error ? err.message : "scores unavailable";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const rec = body as Record<string, unknown>;
  const initials = validateInitials(rec.initials);
  const score = validateInt(rec.score, 0, 1_000_000_000);
  const wave = validateInt(rec.wave, 1, 10_000);
  if (!initials) {
    return NextResponse.json({ error: "initials must be 3 A-Z" }, { status: 400 });
  }
  if (score === null) {
    return NextResponse.json({ error: "score must be an integer" }, { status: 400 });
  }
  if (wave === null) {
    return NextResponse.json({ error: "wave must be an integer" }, { status: 400 });
  }
  try {
    const row = await addScore({ initials, score, wave });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
