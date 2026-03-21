'use client';

type TxState = 'IDLE' | 'IN TRANSACTION' | 'ERROR';

interface TransactionStateBadgeProps {
  state: TxState;
}

const stateConfig: Record<TxState, { label: string; className: string }> = {
  IDLE: { label: 'IDLE', className: 'bg-green-100 text-green-800 border-green-300' },
  'IN TRANSACTION': { label: 'IN TX', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  ERROR: { label: 'ERROR', className: 'bg-red-100 text-red-800 border-red-300' },
};

/** Badge displaying current transaction state of a session */
export function TransactionStateBadge({ state }: TransactionStateBadgeProps) {
  const config = stateConfig[state] ?? stateConfig['IDLE'];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${config.className}`}
    >
      {config.label}
    </span>
  );
}
