import { expect, test } from '@playwright/test';

/**
 * E2E coverage for the session timeout warning (#806).
 *
 * The warning is rendered by SessionTimeoutWarning when the session is within
 * the warning window. It surfaces a stable error code, a countdown, and two
 * actions: extend or sign out. Fail-closed: if the extend call fails the
 * warning stays visible and the user is not silently kept signed in.
 */

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('dev@muxprotocol.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/dashboard**');
}

test.describe('Session timeout warning (#806)', () => {
  test('shows the warning when the session is near expiry', async ({ page }) => {
    await signIn(page);

    // Simulate a near-expiry session by injecting a short-lived expiresAt.
    await page.evaluate(() => {
      const expiresAt = Date.now() + 90_000; // 90 s — within the 2-min window
      window.sessionStorage.setItem(
        'mux_session',
        JSON.stringify({ accessToken: 'mock-access-token', expiresAt }),
      );
      // Dispatch a custom event so the app re-reads the session.
      window.dispatchEvent(new Event('mux:session-updated'));
    });

    await expect(page.getByTestId('session-timeout-warning')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId('session-timeout-countdown')).toContainText(/expires in/i);
  });

  test('does not show the warning when the session has plenty of time left', async ({ page }) => {
    await signIn(page);

    await page.evaluate(() => {
      const expiresAt = Date.now() + 30 * 60 * 1000; // 30 min — outside window
      window.sessionStorage.setItem(
        'mux_session',
        JSON.stringify({ accessToken: 'mock-access-token', expiresAt }),
      );
      window.dispatchEvent(new Event('mux:session-updated'));
    });

    await expect(page.getByTestId('session-timeout-warning')).toBeHidden();
  });

  test('extend session dismisses the warning', async ({ page }) => {
    await signIn(page);

    await page.evaluate(() => {
      const expiresAt = Date.now() + 90_000;
      window.sessionStorage.setItem(
        'mux_session',
        JSON.stringify({ accessToken: 'mock-access-token', expiresAt }),
      );
      window.dispatchEvent(new Event('mux:session-updated'));
    });

    await expect(page.getByTestId('session-timeout-warning')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('session-timeout-extend').click();

    // After a successful extend the warning must be dismissed.
    await expect(page.getByTestId('session-timeout-warning')).toBeHidden({ timeout: 5_000 });
  });

  test('sign-out button triggers sign-out and redirects', async ({ page }) => {
    await signIn(page);

    await page.evaluate(() => {
      const expiresAt = Date.now() + 90_000;
      window.sessionStorage.setItem(
        'mux_session',
        JSON.stringify({ accessToken: 'mock-access-token', expiresAt }),
      );
      window.dispatchEvent(new Event('mux:session-updated'));
    });

    await expect(page.getByTestId('session-timeout-warning')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('session-timeout-signout').click();

    // Fail-closed: sign-out must redirect away from the dashboard.
    await page.waitForURL('**/login**', { timeout: 5_000 });
  });

  test('warning is accessible: alertdialog role and live region present', async ({ page }) => {
    await signIn(page);

    await page.evaluate(() => {
      const expiresAt = Date.now() + 90_000;
      window.sessionStorage.setItem(
        'mux_session',
        JSON.stringify({ accessToken: 'mock-access-token', expiresAt }),
      );
      window.dispatchEvent(new Event('mux:session-updated'));
    });

    const warning = page.getByTestId('session-timeout-warning');
    await expect(warning).toBeVisible({ timeout: 5_000 });
    await expect(warning).toHaveAttribute('role', 'alertdialog');
    // Live region is present for screen-reader announcement.
    await expect(warning.locator('[aria-live]')).toBeAttached();
  });

  test('does not leak secrets in the warning surface', async ({ page }) => {
    await signIn(page);

    await page.evaluate(() => {
      const expiresAt = Date.now() + 90_000;
      window.sessionStorage.setItem(
        'mux_session',
        JSON.stringify({ accessToken: 'mock-access-token', expiresAt }),
      );
      window.dispatchEvent(new Event('mux:session-updated'));
    });

    const warning = page.getByTestId('session-timeout-warning');
    await expect(warning).toBeVisible({ timeout: 5_000 });

    const text = (await warning.textContent()) ?? '';
    // Redaction guard: no raw JWTs, keys, or addresses in the warning UI.
    expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    expect(text).not.toMatch(/S[A-Z2-7]{55}/);
    expect(text).not.toMatch(/mock-access-token/);
  });
});
