import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import { buttonCls } from './Button';

export default function BackLink({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={buttonCls('ghost', `group press -ml-3 w-fit text-sm font-medium text-accent-text hover:text-ink ${className}`)}>
      <ArrowLeft size={16} weight="bold" aria-hidden="true" className="transition-transform duration-150 group-hover:-translate-x-1 motion-reduce:transition-none" />
      {children}
    </Link>
  );
}
