import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.trim();

  let colors = {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
  };

  switch (normalized) {
    // Green Statuses
    case 'Available':
    case 'Ongoing':
    case 'Approved':
    case 'Resolved':
    case 'Verified':
      colors = { bg: 'bg-[#28A745]/15', text: 'text-[#28A745]' };
      break;

    // Blue Statuses
    case 'Allocated':
    case 'Upcoming':
      colors = { bg: 'bg-[#3B82F6]/15', text: 'text-[#3B82F6]' };
      break;

    // Amber Statuses
    case 'Reserved':
    case 'Requested':
    case 'Pending':
      colors = { bg: 'bg-[#F59E0B]/15', text: 'text-[#F59E0B]' };
      break;

    // Orange Statuses
    case 'Under Maintenance':
    case 'In Progress':
    case 'Damaged':
      colors = { bg: 'bg-[#FD7E14]/15', text: 'text-[#FD7E14]' };
      break;

    // Red Statuses
    case 'Lost':
    case 'Cancelled':
    case 'Rejected':
    case 'Missing':
      colors = { bg: 'bg-[#DC3545]/15', text: 'text-[#DC3545]' };
      break;

    // Grey Statuses
    case 'Retired':
    case 'Completed':
      colors = { bg: 'bg-[#6C757D]/15', text: 'text-[#6C757D]' };
      break;

    // Dark Grey Statuses
    case 'Disposed':
      colors = { bg: 'bg-[#343A40]/15', text: 'text-[#343A40]' };
      break;

    // Indigo Statuses
    case 'Technician Assigned':
      colors = { bg: 'bg-[#6366F1]/15', text: 'text-[#6366F1]' };
      break;
  }

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors.bg} ${colors.text} ${
        normalized === 'Cancelled' ? 'line-through' : ''
      }`}
    >
      {normalized}
    </span>
  );
}
