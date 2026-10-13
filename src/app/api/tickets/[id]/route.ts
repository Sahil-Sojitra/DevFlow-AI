import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig } from '@/config/env';
import { LinearAdapter } from '@/adapters/linear';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const config = getAppConfig();

  if (!config.linearApiKey) {
    return NextResponse.json(
      { error: 'Linear API key is not configured.', code: 'MISSING_CREDENTIALS' },
      { status: 400 }
    );
  }

  try {
    const adapter = new LinearAdapter(config);
    const issue = await adapter.getIssue(id);

    if (!issue) {
      return NextResponse.json({ error: `Issue "${id}" not found in Linear.` }, { status: 404 });
    }

    return NextResponse.json({ issue });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || `Failed to fetch issue "${id}"` },
      { status: 500 }
    );
  }
}
