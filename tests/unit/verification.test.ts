import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { VerificationService, redactSecrets } from '../../src/services/verification.js';

describe('VerificationService', () => {
  const testDir = path.resolve('data', 'test-verification-repo');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('redacts tokens and keys from log strings', () => {
    const raw = 'Error with token lin_api_secret123456789 and Bearer abc.xyz.123';
    const redacted = redactSecrets(raw);
    expect(redacted).not.toContain('lin_api_secret123456789');
    expect(redacted).not.toContain('Bearer abc.xyz.123');
    expect(redacted).toContain('[REDACTED_SECRET]');
  });

  it('discovers configured scripts in package.json and accurately marks unconfigured ones', () => {
    const pkg = {
      name: 'test-repo',
      scripts: {
        typecheck: 'tsc --noEmit',
        test: 'vitest run',
      },
    };
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkg), 'utf8');

    const { configured, unconfigured } = VerificationService.discoverChecks(testDir);

    expect(configured.length).toBe(2);
    expect(configured.find((c) => c.name === 'typecheck')?.command).toBe('npm run typecheck');
    expect(configured.find((c) => c.name === 'test')?.command).toBe('npm test');

    expect(unconfigured.length).toBe(2);
    expect(unconfigured.find((c) => c.name === 'lint')).toBeDefined();
    expect(unconfigured.find((c) => c.name === 'build')).toBeDefined();
  });

  it('handles repositories with missing or malformed package.json gracefully', () => {
    const { configured, unconfigured } = VerificationService.discoverChecks(testDir);
    expect(configured.length).toBe(0);
    expect(unconfigured.length).toBe(4);
  });

  it('marks unconfigured checks with not_configured status in runAllChecks', async () => {
    const service = new VerificationService();
    const results = await service.runAllChecks(testDir);

    expect(results.length).toBe(4);
    for (const res of results) {
      expect(res.status).toBe('not_configured');
      expect(res.output).toContain('found in package.json');
    }
  });
});
