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
});
