'use client';

import { useEffect, useRef, useState } from 'react';

/** Stable error codes for the session timeout surface. */
export type SessionTimeoutCode =
  | 'SESSION_TIMEOUT_WARNING'
  | 'SESSION_TIMEOUT_EXPIRED'
  | 'SESSION_TIMEOUT_EXTENDED';

export interface SessionTimeoutWarningProps {
  /** Session expiry timestamp in ms (Date.now() scale). */
  expiresAt: number;
  /** How many ms before expiry to show the warning. Default: 2 minutes. */
  warningMs?: number;
  /** Called when the user requests a session extension. */
  onExtend: () => Promise<void>;
  /** Called when the session expires without extension. */
  onExpired: () => void;
  /** Optional reporter for ops-safe observability (code + correlationId only). */
  onEvent?: (code: SessionTimeoutCode, correlationId: string) => void;
}

function newCorrelationId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `stw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_WARNING_MS = 2 * 60 * 1000; // 2 minutes

export function SessionTimeoutWarning({
  expiresAt,
  warningMs = DEFAULT_WARNING_MS,
  onExtend,
  onExpired,
  onEvent,
}: SessionTimeoutWarningProps) {
  const [visible, setVisible] = useState(false);
  const [extending, setExtending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const correlationIdRef = useRef<string>(newCorrelationId());
  const expiredFiredRef = useRef(false);

  useEffect(() => {
    correlationIdRef.current = newCorrelationId();
    expiredFiredRef.current = false;

    const tick = () => {
      const now = Date.now();
      const remaining = expiresAt - now;

      if (remaining <= 0) {
        setVisible(false);
        setSecondsLeft(0);
        if (!expiredFiredRef.current) {
          expiredFiredRef.current = true;
          onEvent?.('SESSION_TIMEOUT_EXPIRED', correlationIdRef.current);
          onExpired();
        }
        return;
      }

      if (remaining <= warningMs) {
        setVisible(true);
        setSecondsLeft(Math.ceil(remaining / 1000));
        onEvent?.('SESSION_TIMEOUT_WARNING', correlationIdRef.current);
      } else {
        setVisible(false);
        setSecondsLeft(0);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, warningMs, onExpired, onEvent]);

  const handleExtend = async () => {
    if (extending) return;
    setExtending(true);
    try {
      await onExtend();
      onEvent?.('SESSION_TIMEOUT_EXTENDED', correlationIdRef.current);
      setVisible(false);
    } finally {
      setExtending(false);
    }
  };

  if (!visible) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeLabel = minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`;

  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="session-timeout-heading"
      aria-describedby="session-timeout-desc"
      data-testid="session-timeout-warning"
      className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-yellow-500 bg-yellow-950 p-4 shadow-lg"
    >
      {/* Accessible live region so screen readers announce the countdown */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        Your session expires in {timeLabel}. Extend your session to stay signed in.
      </div>

      <h2
        id="session-timeout-heading"
        className="text-sm font-semibold text-yellow-300 mb-1"
      >
        Session expiring soon
      </h2>
      <p
        id="session-timeout-desc"
        className="text-xs text-yellow-200 mb-3"
        data-testid="session-timeout-countdown"
      >
        Your session expires in{' '}
        <span className="font-mono font-bold">{timeLabel}</span>.
        Extend your session to stay signed in.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleExtend}
          disabled={extending}
          data-testid="session-timeout-extend"
          className="flex-1 rounded bg-yellow-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {extending ? 'Extending…' : 'Extend session'}
        </button>
        <button
          type="button"
          onClick={onExpired}
          data-testid="session-timeout-signout"
          className="rounded border border-yellow-600 px-3 py-1.5 text-xs text-yellow-300 hover:bg-yellow-900 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
