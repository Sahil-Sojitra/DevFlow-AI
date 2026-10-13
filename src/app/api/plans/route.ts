import { NextResponse } from 'next/server';
import { PlanStorageService } from '@/services/plan-storage';

export async function GET() {
  try {
    const storage = new PlanStorageService();
    const plans = storage.listPlans();
    return NextResponse.json({ plans });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to list plans.' },
      { status: 500 }
    );
  }
}
