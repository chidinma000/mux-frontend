import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

interface CriticalComponentProps {
  id: string;
  name: string;
  status: 'critical' | 'warning' | 'ok';
  lastModified: string;
  type: 'wallet' | 'transaction' | 'auth' | 'payment';
}

function CriticalComponentDisplay(props: CriticalComponentProps) {
  const isCritical = props.status === 'critical';
  return (
    <div className={`p-4 border rounded-lg ${isCritical ? 'border-red-500' : 'border-yellow-500'}`}>
      <span className={isCritical ? 'text-red-500' : 'text-yellow-500'}>
        {isCritical ? '🔴' : '🟡'} {props.name}
      </span>
      <span className="text-gray-400 ml-2">{props.type}</span>
    </div>
  );
}

const meta: Meta<CriticalComponentProps> = {
  title: 'Critical/CriticalComponents',
  component: CriticalComponentDisplay,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'CI-critical component stories for automated testing pipeline',
      },
    },
  },
};

export default meta;
type Story = StoryObj<CriticalComponentProps>;

export const WalletComponent: Story = {
  args: {
    id: 'wallet-001',
    name: 'ConnectWallet',
    status: 'critical',
    lastModified: '2026-09-26',
    type: 'wallet',
  },
};

export const TransactionComponent: Story = {
  args: {
    id: 'tx-001',
    name: 'ProcessTransaction',
    status: 'critical',
    lastModified: '2026-09-26',
    type: 'transaction',
  },
};

export const AuthComponent: Story = {
  args: {
    id: 'auth-001',
    name: 'JWTVerification',
    status: 'critical',
    lastModified: '2026-09-26',
    type: 'auth',
  },
};

export const PaymentComponent: Story = {
  args: {
    id: 'pay-001',
    name: 'ProcessPayment',
    status: 'warning',
    lastModified: '2026-09-26',
    type: 'payment',
  },
};
