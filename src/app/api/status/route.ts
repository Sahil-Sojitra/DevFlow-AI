import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { getAppConfig } from '@/config/env';
import { LinearAdapter } from '@/adapters/linear';

export async function GET() {
  const config = getAppConfig();
  const antigravityBinaryExists = fs.existsSync(config.antigravityBinPath);

  let linearUser: { id: string; name: string; email?: string } | null = null;
  let linearError: string | null = null;

  if (config.linearApiKey) {
    try {
      const adapter = new LinearAdapter(config);
      const viewer = await adapter.getViewer();
      linearUser = {
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
      };
    } catch (err: unknown) {
      linearError = (err as Error).message;
    }
  }

  return NextResponse.json({
    status: 'ok',
    version: '0.3.0',
    antigravity: {
      configured: true,
      binaryPath: config.antigravityBinPath,
      existsOnDisk: antigravityBinaryExists,
    },
    linear: {
      configured: Boolean(config.linearApiKey),
      authenticatedUser: linearUser,
      error: linearError,
    },
    repositoriesCount: config.allowedWorkingDirs.length,
    plansDirectory: config.plansDir,
  });
}
