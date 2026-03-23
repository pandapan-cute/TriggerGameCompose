import Link from 'next/dist/client/link';
import React from 'react';

interface WhiteFillButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href: string;
  className?: string;
}

export const WhiteFillButton: React.FC<WhiteFillButtonProps> = ({
  children,
  onClick,
  href,
  className = '',
}) => {
  return (
    <Link
      onClick={onClick}
      href={href}
      className={`
        px-8 py-2
        bg-white
        text-gray-800
        rounded-lg
        font-medium
        transition-all duration-200
        hover:bg-slate-700 hover:border-sky-500 hover:text-white
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {children}
    </Link>
  );
};