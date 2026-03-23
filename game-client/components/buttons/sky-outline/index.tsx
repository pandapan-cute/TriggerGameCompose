import Link from 'next/dist/client/link';
import React from 'react';

interface SkyOutlineButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href: string;
  className?: string;
}

export const SkyOutlineButton: React.FC<SkyOutlineButtonProps> = ({
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
        border-4 border-sky-400
        text-sky-400
        rounded-lg
        font-bold
        transition-all duration-200
        hover:bg-sky-50 hover:border-sky-500 hover:text-sky-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {children}
    </Link>
  );
};