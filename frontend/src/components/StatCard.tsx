import React from 'react';

interface StatCardProps {
  count: number | string;
  label: string;
  onClick?: () => void;
}

export default function StatCard({ count, label, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-sm border border-[#E3E3E6] bg-white p-4 transition-all ${
        onClick ? 'cursor-pointer hover:border-[#714B67] hover:shadow-sm' : ''
      }`}
    >
      <div className="text-2xl font-semibold text-[#714B67]">{count}</div>
      <div className="text-xs text-[#6C757D] font-medium mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}
