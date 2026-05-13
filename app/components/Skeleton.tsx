import React from "react";

interface SkeletonProps {
  className?: string;
  variant?: "rect" | "circle";
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "", variant = "rect" }) => {
  const baseClasses = "animate-pulse bg-slate-800";
  const variantClasses = variant === "circle" ? "rounded-full" : "rounded-lg";
  
  return <div className={`${baseClasses} ${variantClasses} ${className}`} />;
};
