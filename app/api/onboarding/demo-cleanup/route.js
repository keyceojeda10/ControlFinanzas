import { NextResponse } from 'next/server'

// Demo mode removed in onboarding v2. This endpoint is kept as a no-op
// to avoid 404s from any cached client code during rollout.
export async function DELETE() {
  return NextResponse.json({ ok: true })
}
