import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';

describe('SessionTimeoutWarning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is hidden when session has plenty of time left', () => {
    render(
      <SessionTimeoutWarning
        expiresAt={Date.now() + 30 * 60 * 1000}
        onExtend={async () => {}}
        onExpired={() => {}}
      />,
    );
    expect(screen.queryByTestId('session-timeout-warning')).toBeNull();
  });

  it('shows the warning when within the warning window', () => {
    render(
      <SessionTimeoutWarning
        expiresAt={Date.now() + 90_000}
        onExtend={async () => {}}
        onExpired={() => {}}
      />,
    );
    expect(screen.getByTestId('session-timeout-warning')).toBeInTheDocument();
    expect(screen.getByTestId('session-timeout-countdown')).toHaveTextContent(/expires in/i);
  });

  it('calls onExpired and hides when the session expires', () => {
    const onExpired = vi.fn();
    render(
      <SessionTimeoutWarning
        expiresAt={Date.now() + 2_000}
        warningMs={5_000}
        onExtend={async () => {}}
        onExpired={onExpired}
      />,
    );
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(onExpired).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('session-timeout-warning')).toBeNull();
  });

  it('calls onExtend and dismisses the warning on extend', async () => {
    const onExtend = vi.fn().mockResolvedValue(undefined);
    render(
      <SessionTimeoutWarning
        expiresAt={Date.now() + 90_000}
        onExtend={onExtend}
        onExpired={() => {}}
      />,
    );
    await userEvent.click(screen.getByTestId('session-timeout-extend'));
    expect(onExtend).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('session-timeout-warning')).toBeNull();
  });

  it('emits SESSION_TIMEOUT_WARNING event via onEvent', () => {
    const onEvent = vi.fn();
    render(
      <SessionTimeoutWarning
        expiresAt={Date.now() + 90_000}
        onExtend={async () => {}}
        onExpired={() => {}}
        onEvent={onEvent}
      />,
    );
    expect(onEvent).toHaveBeenCalledWith('SESSION_TIMEOUT_WARNING', expect.any(String));
  });

  it('emits SESSION_TIMEOUT_EXTENDED after a successful extend', async () => {
    const onEvent = vi.fn();
    render(
      <SessionTimeoutWarning
        expiresAt={Date.now() + 90_000}
        onExtend={async () => {}}
        onExpired={() => {}}
        onEvent={onEvent}
      />,
    );
    await userEvent.click(screen.getByTestId('session-timeout-extend'));
    expect(onEvent).toHaveBeenCalledWith('SESSION_TIMEOUT_EXTENDED', expect.any(String));
  });

  it('has alertdialog role and a live region for a11y', () => {
    render(
      <SessionTimeoutWarning
        expiresAt={Date.now() + 90_000}
        onExtend={async () => {}}
        onExpired={() => {}}
      />,
    );
    const warning = screen.getByTestId('session-timeout-warning');
    expect(warning).toHaveAttribute('role', 'alertdialog');
    expect(warning.querySelector('[aria-live]')).toBeTruthy();
  });

  it('does not render raw tokens in the warning text', () => {
    render(
      <SessionTimeoutWarning
        expiresAt={Date.now() + 90_000}
        onExtend={async () => {}}
        onExpired={() => {}}
      />,
    );
    const text = screen.getByTestId('session-timeout-warning').textContent ?? '';
    expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    expect(text).not.toMatch(/S[A-Z2-7]{55}/);
  });
});
