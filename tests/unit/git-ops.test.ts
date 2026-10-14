import { describe, it, expect } from 'vitest';
import { parsePorcelainStatus, detectChangedFiles } from '../../src/services/git-ops.js';

describe('Git Operations Service', () => {
  it('accurately parses changed files and distinguishes pre-existing files from session files', () => {
    const mockPorcelain = [
      ' M src/index.ts',
      'A  src/components/NewFeature.tsx',
      '?? src/utils/helper.ts',
      ' D old-file.txt',
    ].join('\n');

    // Pre-existing dirty files before session started:
    const baselineFiles = ['src/index.ts'];

    const changed = parsePorcelainStatus(mockPorcelain, baselineFiles);

    expect(changed.length).toBe(4);

    const indexFile = changed.find((f) => f.path === 'src/index.ts');
    expect(indexFile).toBeDefined();
    expect(indexFile?.status).toBe('modified');
    expect(indexFile?.isPreExisting).toBe(true); // Identified as pre-existing!

    const newFeature = changed.find((f) => f.path === 'src/components/NewFeature.tsx');
    expect(newFeature).toBeDefined();
    expect(newFeature?.status).toBe('added');
    expect(newFeature?.isPreExisting).toBe(false); // New in session!

    const helper = changed.find((f) => f.path === 'src/utils/helper.ts');
    expect(helper).toBeDefined();
    expect(helper?.status).toBe('added');
    expect(helper?.isPreExisting).toBe(false);

    const deleted = changed.find((f) => f.path === 'old-file.txt');
    expect(deleted).toBeDefined();
    expect(deleted?.status).toBe('deleted');

    // Test with custom runner in detectChangedFiles
    const customChanged = detectChangedFiles('D:/dummy-repo', baselineFiles, () => mockPorcelain);
    expect(customChanged.length).toBe(4);
  });
});
