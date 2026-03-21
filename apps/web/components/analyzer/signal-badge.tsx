'use client';

interface Props {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message?: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

/** Format signal type for display */
function formatType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SignalBadge({ type, severity, message }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_STYLES[severity]}`}
      title={message}
    >
      {severity === 'critical' && '! '}
      {severity === 'warning' && '⚠ '}
      {formatType(type)}
    </span>
  );
}
