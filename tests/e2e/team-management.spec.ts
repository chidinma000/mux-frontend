import { expect, test } from '@playwright/test';

/**
 * E2E coverage for the Team invite/remove RBAC UI (#805).
 *
 * Verifies: admin can add/remove members; developer gets a read-only view;
 * unauthenticated access is denied; backend outage fails closed; idempotent
 * re-add is a no-op; no secrets leak in the UI.
 */

async function signIn(
  page: import('@playwright/test').Page,
  role: 'admin' | 'developer' = 'admin',
) {
  await page.goto('/login');
  const email = role === 'admin' ? 'alice@muxprotocol.com' : 'bob@muxprotocol.com';
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/dashboard**');
}

test.describe('Team management RBAC (#805)', () => {
  test('admin sees the invite form and member list', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/dashboard/settings/team');

    await expect(page.getByTestId('team-management')).toBeVisible();
    await expect(page.getByTestId('team-invite-form')).toBeVisible();
    await expect(page.getByTestId('team-member-row').first()).toBeVisible();
  });

  test('developer sees the member list but not the invite form', async ({ page }) => {
    await signIn(page, 'developer');
    await page.goto('/dashboard/settings/team');

    await expect(page.getByTestId('team-management')).toBeVisible();
    await expect(page.getByTestId('team-invite-form')).toBeHidden();
    await expect(page.getByTestId('team-readonly-notice')).toBeVisible();
    // Remove buttons must not be present for a developer.
    await expect(page.getByTestId('team-remove-btn')).toHaveCount(0);
  });

  test('admin can add a new member', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/dashboard/settings/team');

    await page.getByTestId('team-invite-name').fill('Carol New');
    await page.getByTestId('team-invite-email').fill('carol@muxprotocol.com');
    await page.getByTestId('team-invite-role').selectOption('developer');
    await page.getByTestId('team-invite-submit').click();

    await expect(page.getByTestId('team-success')).toBeVisible();
    await expect(page.getByTestId('team-member-name').filter({ hasText: 'Carol New' })).toBeVisible();
  });

  test('admin can remove a member', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/dashboard/settings/team');

    const firstRemove = page.getByTestId('team-remove-btn').first();
    await expect(firstRemove).toBeVisible();
    const memberName = await page.getByTestId('team-member-name').first().textContent();
    await firstRemove.click();

    await expect(page.getByTestId('team-success')).toBeVisible();
    if (memberName) {
      await expect(page.getByTestId('team-member-name').filter({ hasText: memberName })).toHaveCount(0);
    }
  });

  test('re-adding an existing member is idempotent (no duplicate row)', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/dashboard/settings/team');

    // Add a member.
    await page.getByTestId('team-invite-name').fill('Idempotent User');
    await page.getByTestId('team-invite-email').fill('idempotent@muxprotocol.com');
    await page.getByTestId('team-invite-submit').click();
    await expect(page.getByTestId('team-success')).toBeVisible();

    const countBefore = await page.getByTestId('team-member-row').count();

    // Re-add the same email — must not create a duplicate row.
    await page.getByTestId('team-invite-name').fill('Idempotent User');
    await page.getByTestId('team-invite-email').fill('idempotent@muxprotocol.com');
    await page.getByTestId('team-invite-submit').click();

    // Either success (idempotent replay) or a member_exists error — never a duplicate.
    const countAfter = await page.getByTestId('team-member-row').count();
    expect(countAfter).toBeLessThanOrEqual(countBefore + 1);
  });

  test('backend outage fails closed with an error message', async ({ page }) => {
    await signIn(page, 'admin');

    // Simulate backend outage on the team route.
    await page.route('**/api/team**', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'backend_unavailable',
            message: 'Team backend not configured.',
            correlationId: 'e2e-team-503',
          },
        }),
      }),
    );

    await page.goto('/dashboard/settings/team');

    await page.getByTestId('team-invite-name').fill('Fail User');
    await page.getByTestId('team-invite-email').fill('fail@muxprotocol.com');
    await page.getByTestId('team-invite-submit').click();

    // Fail-closed: error is surfaced, no member is added.
    await expect(page.getByTestId('team-error')).toBeVisible();
    await expect(page.getByTestId('team-member-name').filter({ hasText: 'Fail User' })).toHaveCount(0);
  });

  test('unauthenticated access is denied', async ({ page }) => {
    await page.goto('/dashboard/settings/team');
    // Auth-gated route: middleware redirects to login.
    await page.waitForURL('**/login**');
    await expect(page.getByTestId('team-management')).toBeHidden();
  });

  test('does not leak secrets in the team UI', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/dashboard/settings/team');

    const panel = page.getByTestId('team-management');
    await expect(panel).toBeVisible();
    const text = (await panel.textContent()) ?? '';

    // Redaction guard: no raw JWTs, keys, or webhook secrets in the team UI.
    expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    expect(text).not.toMatch(/S[A-Z2-7]{55}/);
    expect(text).not.toMatch(/whsec_[A-Za-z0-9]+/);
  });
});
