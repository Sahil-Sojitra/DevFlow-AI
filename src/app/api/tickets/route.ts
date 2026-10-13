import { NextResponse } from 'next/server';
import { getAppConfig } from '@/config/env';
import { LinearAdapter, LinearAuthenticationError } from '@/adapters/linear';

export async function GET() {
  const config = getAppConfig();

  if (!config.linearApiKey) {
    return NextResponse.json(
      {
        error: 'Linear API key is not configured. Please add LINEAR_API_KEY to your .env file.',
        code: 'MISSING_CREDENTIALS',
      },
      { status: 400 }
    );
  }

  try {
    const adapter = new LinearAdapter(config);
    const issues = await adapter.getAssignedIssues();
    return NextResponse.json({ issues });
  } catch (err: unknown) {
    if (err instanceof LinearAuthenticationError) {
      return NextResponse.json(
        { error: 'Failed to authenticate with Linear. Please verify LINEAR_API_KEY.', code: 'AUTH_FAILED' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to fetch tickets from Linear' },
      { status: 500 }
    );
  }
}
