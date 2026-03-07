const { launchBrowser, REASON_CODES } = require('./playwrightBrowserService');

describe('playwrightBrowserService', () => {
  it('retorna PACKAGE_MISSING quando playwright não está disponível', async () => {
    const result = await launchBrowser({
      config: {
        playwrightEnabled: true,
        playwrightBrowser: 'chromium',
        headless: true,
        playwrightLaunchTimeoutMs: 30000,
        playwrightExtraArgs: ['--no-sandbox'],
      },
      playwrightLoader: () => null,
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe(REASON_CODES.PACKAGE_MISSING);
  });

  it('retorna BROWSER_MISSING quando chromium não está disponível', async () => {
    const result = await launchBrowser({
      config: {
        playwrightEnabled: true,
        playwrightBrowser: 'chromium',
        headless: true,
        playwrightLaunchTimeoutMs: 30000,
        playwrightExtraArgs: ['--no-sandbox'],
      },
      playwrightLoader: () => ({}),
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe(REASON_CODES.BROWSER_MISSING);
  });

  it('retorna LAUNCH_FAILED quando launch falha', async () => {
    const result = await launchBrowser({
      config: {
        playwrightEnabled: true,
        playwrightBrowser: 'chromium',
        headless: true,
        playwrightLaunchTimeoutMs: 30000,
        playwrightExtraArgs: ['--no-sandbox'],
      },
      playwrightLoader: () => ({
        chromium: {
          launch: jest.fn().mockRejectedValue(new Error('No executable found')),
        },
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe(REASON_CODES.LAUNCH_FAILED);
  });


  it('retorna BROWSER_MISSING quando executável do Chromium não existe no runtime', async () => {
    const result = await launchBrowser({
      config: {
        playwrightEnabled: true,
        playwrightBrowser: 'chromium',
        headless: true,
        playwrightLaunchTimeoutMs: 30000,
        playwrightExtraArgs: ['--no-sandbox'],
      },
      playwrightLoader: () => ({
        chromium: {
          launch: jest.fn().mockRejectedValue(new Error("browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium/chrome")),
        },
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe(REASON_CODES.BROWSER_MISSING);
  });

  it('retorna SYSTEM_DEPS_MISSING quando faltar biblioteca de sistema Linux', async () => {
    const result = await launchBrowser({
      config: {
        playwrightEnabled: true,
        playwrightBrowser: 'chromium',
        headless: true,
        playwrightLaunchTimeoutMs: 30000,
        playwrightExtraArgs: ['--no-sandbox'],
      },
      playwrightLoader: () => ({
        chromium: {
          launch: jest.fn().mockRejectedValue(new Error('error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file')),
        },
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe(REASON_CODES.SYSTEM_DEPS_MISSING);
    expect(result.missingLibrary).toBe('libglib-2.0.so.0');
    expect(result.errorMessage).toBe('error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file');
  });

  it('compacta errorMessage quando Playwright retorna call log gigante', async () => {
    const giantMessage = [
      'browserType.launch: Target page, context or browser has been closed',
      'Browser logs:',
      '<launching> ...',
      '[pid=32][err] /root/.cache/ms-playwright/.../chrome-headless-shell: error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file: No such file or directory',
      'Call log:',
      '- <launching> ...',
      '- [pid=32][err] ...',
    ].join('\n');

    const result = await launchBrowser({
      config: {
        playwrightEnabled: true,
        playwrightBrowser: 'chromium',
        headless: true,
        playwrightLaunchTimeoutMs: 30000,
        playwrightExtraArgs: ['--no-sandbox'],
      },
      playwrightLoader: () => ({
        chromium: {
          launch: jest.fn().mockRejectedValue(new Error(giantMessage)),
        },
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe(REASON_CODES.SYSTEM_DEPS_MISSING);
    expect(result.errorMessage).toContain('error while loading shared libraries');
    expect(result.errorMessage).not.toContain('Call log:');
  });
});
