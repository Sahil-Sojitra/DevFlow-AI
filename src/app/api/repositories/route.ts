import { NextResponse } from 'next/server';
import { RepositoryRegistry } from '@/services/repo-registry';

export async function GET() {
  try {
    const registry = new RepositoryRegistry();
    const repositories = registry.getRepositories();
    return NextResponse.json({ repositories });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to inspect repositories.' },
      { status: 500 }
    );
  }
}
