import Link from "next/link";
import React from "react";

/**
 * 対戦結果画面の遷移ボタン種別。
 */
type ResultNavVariant = "back" | "next";

interface ResultNavButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: ResultNavVariant;
  onClick?: () => void;
}

const variantClassMap: Record<ResultNavVariant, string> = {
  back: "text-slate-100",
  next: "text-cyan-400",
};

/**
 * 対戦結果画面の下部導線で使う遷移ボタン。
 */
export const ResultNavButton: React.FC<ResultNavButtonProps> = ({
  href,
  children,
  className = "",
  variant = "back",
  onClick = () => { },
}) => {
  return (
    <Link
      href={href}
      className={`transition-opacity hover:opacity-80 ${variantClassMap[variant]} ${className}`}
      onClick={onClick}
    >
      {children}
    </Link>
  );
};
