import { NextRequest, NextResponse } from 'next/server';
import { PlanStorageService } from '@/services/plan-storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const storage = new PlanStorageService();
    const plan = storage.getPlan(id);

    if (!plan) {
      return NextResponse.json({ error: `Plan for issue "${id}" not found.` }, { status: 404 });
    }

    return NextResponse.json({ plan });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || `Failed to read plan for issue "${id}".` },
      { status: 500 }
    );
  }
}
