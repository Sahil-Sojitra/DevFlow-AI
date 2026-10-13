import { NextRequest, NextResponse } from 'next/server';
import {
  RepositoryRegistry,
  saveCustomRepository,
  removeCustomRepository,
} from '@/services/repo-registry';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const repoPath = body?.path;

    if (!repoPath || typeof repoPath !== 'string' || repoPath.trim().length === 0) {
      return NextResponse.json({ error: 'Repository path is required.' }, { status: 400 });
    }

    const resolved = saveCustomRepository(repoPath);
    const registry = new RepositoryRegistry();
    const repositories = registry.getRepositories();
    const matched = repositories.find((r) => r.path.toLowerCase() === resolved.toLowerCase());

    return NextResponse.json({
      success: true,
      repository: matched,
      repositories,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to add repository.' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get('path');

    if (!target) {
      return NextResponse.json({ error: 'Repository path is required.' }, { status: 400 });
    }

    const removed = removeCustomRepository(target);
    const registry = new RepositoryRegistry();
    const repositories = registry.getRepositories();

    return NextResponse.json({
      success: removed,
      repositories,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to remove repository.' },
      { status: 400 }
    );
  }
}
