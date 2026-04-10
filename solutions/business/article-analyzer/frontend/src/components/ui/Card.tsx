import clsx from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingMap = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export default function Card({ children, className, padding = 'lg' }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-slate-200 bg-white shadow-sm',
        'dark:border-slate-700 dark:bg-slate-800',
        paddingMap[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
