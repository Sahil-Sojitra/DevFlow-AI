import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadConfig } from '../../src/config/env.js';

describe('Configuration Loader', () => {
  it('loads default configuration when no environment variables are set', () => {
    const config = loadConfig({}, 'C:\\dummy\\workspace');
    expect(config.defaultTimeoutMs).toBe(300000);
    expect(config.enableIntegrationTest).toBe(false);
    expect(config.allowedWorkingDirs).toEqual([path.resolve('C:\\dummy\\workspace')]);
    expect(config.antigravityBinPath).toBeDefined();
  });

  it('parses custom ANTIGRAVITY_BIN_PATH and DEVFLOW_TIMEOUT_MS', () => {
    const customBin = 'C:\\custom\\path\\agy.exe';
    const config = loadConfig({
      ANTIGRAVITY_BIN_PATH: customBin,
      DEVFLOW_TIMEOUT_MS: '45000',
      DEVFLOW_INTEGRATION_TEST: 'true',
    });

    expect(config.antigravityBinPath).toBe(path.resolve(customBin));
    expect(config.defaultTimeoutMs).toBe(45000);
    expect(config.enableIntegrationTest).toBe(true);
  });

  it('parses multiple allowed working directories separated by comma or semicolon', () => {
    const config = loadConfig({
      DEVFLOW_ALLOWED_WORKING_DIRS: 'C:\\projects\\app1, C:\\projects\\app2; D:\\work\\app3',
    });

    expect(config.allowedWorkingDirs).toEqual([
      path.resolve('C:\\projects\\app1'),
      path.resolve('C:\\projects\\app2'),
      path.resolve('D:\\work\\app3'),
    ]);
  });
});
