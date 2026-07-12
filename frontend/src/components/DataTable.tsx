import React from 'react';

interface Column<T> {
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortKey?: keyof T;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export default function DataTable<T>({ columns, data, onRowClick, emptyMessage = 'No records found' }: DataTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto border border-[#E3E3E6] bg-white rounded-sm">
      <table className="min-w-full divide-y divide-[#E3E3E6] text-left text-xs text-[#1F1F1F]">
        <thead className="bg-[#F7F7F8] font-semibold text-[#6C757D]">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className="px-4 py-2 border-b border-[#E3E3E6] font-medium uppercase tracking-wider text-[10px]">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E3E3E6] bg-white">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-xs text-[#6C757D]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-[#F7F7F8]' : ''}`}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="px-4 py-2 truncate max-w-xs">
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
