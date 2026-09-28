'use client';

import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[200px] rounded-lg bg-black/4 border border-dashed border-black/12">
      {icon && <div className="text-5xl mb-4 opacity-50">{icon}</div>}
      <h2 className="text-base font-semibold text-gray-600 mb-2">{title}</h2>
      <p className="text-sm text-gray-400 text-center max-w-[400px]">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 px-4 py-2 border border-gray-400 rounded text-sm hover:bg-gray-100 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export const WalletEmptyState: React.FC = () => (
  <EmptyState
    title="No Wallets Found"
    description="Connect a wallet to view your accounts and transaction history."
    icon={<span>👛</span>}
    actionLabel="Connect Wallet"
  />
);

export const TransactionEmptyState: React.FC = () => (
  <EmptyState
    title="No Transactions"
    description="Your transaction history will appear here once you make a transaction."
    icon={<span>📋</span>}
    actionLabel="New Transaction"
  />
);

export const NetworkEmptyState: React.FC = () => (
  <EmptyState
    title="No Network Configured"
    description="Configure a network to start interacting with the blockchain."
    icon={<span>🌐</span>}
    actionLabel="Add Network"
  />
);
