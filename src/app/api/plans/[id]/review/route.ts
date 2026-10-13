import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PlanStorageService } from '@/services/plan-storage';

const ReviewRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let bodyJson: unknown;

  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const parsed = ReviewRequestSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}` },
      { status: 400 }
    );
  }

  const { status, notes } = parsed.data;
  const storage = new PlanStorageService();

  // Verify plan exists before recording review
  const plan = storage.getPlan(id);
  if (!plan) {
    return NextResponse.json({ error: `Cannot review non-existent plan for issue "${id}".` }, { status: 404 });
  }

  // Persist review state
  const record = storage.saveReview(id, status, notes);

  return NextResponse.json({
    success: true,
    issueIdentifier: id,
    status: record.status,
    updatedAt: record.updatedAt,
    notes: record.notes,
    message:
      status === 'approved'
        ? 'Plan approved. Note: Plan approval does NOT automatically start implementation in Milestone 3.'
        : 'Plan rejected.',
  });
}
