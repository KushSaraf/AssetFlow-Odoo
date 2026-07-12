'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import DataTable from '../../../components/DataTable';
import { ShieldAlert, BarChart3, Download, PieChart, TrendingUp, Calendar, Wrench } from 'lucide-react';

interface RankedAsset {
  asset_id: string;
  tag: string;
  name: string;
  status: string;
  usage_count: number;
  last_used_at: string | null;
}

interface UtilizationData {
  total_assets: number;
  allocated: number;
  available: number;
  maintenance: number;
  utilization_rate: number;
  most_used: RankedAsset[];
  idle_assets: RankedAsset[];
  idle_threshold_days: number;
}

interface DepreciationItem {
  asset_id: string;
  name: string;
  tag: string;
  acquisition_cost: number | null;
  current_value: number;
}

interface MaintenanceRequest {
  id: string;
  asset: { name: string; tag: string };
  priority: string;
}

interface Allocation {
  id: string;
  department_id: string | null;
  department?: { name: string } | null;
  asset: { acquisition_cost: number | null };
  returned_at: string | null;
}

interface Booking {
  id: string;
  start_time: string;
  status: string;
}

type ReportTab = 'utilization' | 'depreciation' | 'maintenance' | 'departments' | 'heatmap';

export default function ReportsPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportTab>('utilization');

  // Fetch utilization
  const { data: utilization } = useQuery<UtilizationData>({
    queryKey: ['reports-utilization'],
    queryFn: () => apiFetch('/reports/asset-utilization'),
    enabled: role !== 'Employee',
  });

  // Fetch depreciation
  const { data: depreciation = [] } = useQuery<DepreciationItem[]>({
    queryKey: ['reports-depreciation'],
    queryFn: () => apiFetch('/reports/depreciation'),
    enabled: role !== 'Employee',
  });

  // Fetch raw records to aggregate other reports client-side
  const { data: maintenanceRequests = [] } = useQuery<MaintenanceRequest[]>({
    queryKey: ['maintenance-requests'],
    queryFn: () => apiFetch('/maintenance-requests'),
    enabled: role !== 'Employee' && activeTab === 'maintenance',
  });

  const { data: allocations = [] } = useQuery<Allocation[]>({
    queryKey: ['allocations'],
    queryFn: () => apiFetch('/allocations'),
    enabled: role !== 'Employee' && activeTab === 'departments',
  });

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: () => apiFetch('/bookings'),
    enabled: role !== 'Employee' && activeTab === 'heatmap',
  });

  if (role === 'Employee') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldAlert size={48} className="text-red-500" />
        <h2 className="text-lg font-semibold text-[#1F1F1F]">Access Forbidden</h2>
        <p className="text-xs text-[#6C757D] max-w-sm">
          Only Managers, Department Heads, and Admins can view analytical reports.
        </p>
      </div>
    );
  }

  // Aggregate Maintenance Frequency
  const getMaintenanceFrequency = () => {
    const counts: Record<string, { name: string; tag: string; count: number }> = {};
    maintenanceRequests.forEach((req) => {
      const tag = req.asset.tag;
      if (!counts[tag]) {
        counts[tag] = { name: req.asset.name, tag, count: 0 };
      }
      counts[tag].count += 1;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  };

  // Aggregate Department summaries
  const getDepartmentSummaries = () => {
    const depts: Record<string, { name: string; count: number; value: number }> = {};
    allocations
      .filter((a) => !a.returned_at)
      .forEach((a) => {
        const deptName = a.department?.name || 'Shared / Personal';
        if (!depts[deptName]) {
          depts[deptName] = { name: deptName, count: 0, value: 0 };
        }
        depts[deptName].count += 1;
        depts[deptName].value += a.asset.acquisition_cost || 0;
      });
    return Object.values(depts);
  };

  // Aggregate Bookings Heatmap (Hour of Day 0-23 vs Day of Week 0-6)
  const getBookingHeatmap = () => {
    const grid: number[][] = Array(7)
      .fill(0)
      .map(() => Array(24).fill(0));

    bookings
      .filter((b) => b.status !== 'Cancelled')
      .forEach((b) => {
        const date = new Date(b.start_time);
        const day = date.getDay();
        const hour = date.getHours();
        grid[day][hour] += 1;
      });
    return grid;
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (format === 'pdf') {
      toast('Opening print dialog. Save as PDF to export.');
      setTimeout(() => window.print(), 500);
      return;
    }

    if (format === 'csv') {
      let csvContent = '';
      if (activeTab === 'depreciation') {
        csvContent += 'Asset Tag,Asset Name,Acquisition Cost,Current Value,Total Depreciation\n';
        depreciation.forEach((row) => {
          const cost = row.acquisition_cost || 0;
          const dep = cost - row.current_value;
          csvContent += `"${row.tag}","${row.name}",${cost},${row.current_value},${dep}\n`;
        });
      } else if (activeTab === 'maintenance') {
        csvContent += 'Asset Tag,Asset Name,Total Maintenance Occurrences\n';
        getMaintenanceFrequency().forEach((row) => {
          csvContent += `"${row.tag}","${row.name}",${row.count}\n`;
        });
      } else if (activeTab === 'departments') {
        csvContent += 'Department,Active Allocated Assets,Total Value Held\n';
        getDepartmentSummaries().forEach((row) => {
          csvContent += `"${row.name}",${row.count},${row.value}\n`;
        });
      } else {
        toast('CSV export is only supported for tabular reports.', 'error');
        return;
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `AssetFlow_${activeTab}_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast('CSV Downloaded successfully!');
    }
  };

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1F1F1F]">Reports & Analytics</h1>
          <p className="text-xs text-[#6C757D] mt-0.5">Analyze asset utilization, depreciation, and service logs.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1F1F] hover:bg-[#F7F7F8] transition-colors"
          >
            <Download size={12} />
            Export CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-1.5 rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1F1F] hover:bg-[#F7F7F8] transition-colors"
          >
            <Download size={12} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-[#E3E3E6]">
        <button
          onClick={() => setActiveTab('utilization')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'utilization'
              ? 'border-[#714B67] text-[#714B67]'
              : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
          }`}
        >
          Utilization Summary
        </button>
        <button
          onClick={() => setActiveTab('depreciation')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'depreciation'
              ? 'border-[#714B67] text-[#714B67]'
              : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
          }`}
        >
          Asset Depreciation
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'maintenance'
              ? 'border-[#714B67] text-[#714B67]'
              : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
          }`}
        >
          Maintenance Frequency
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'departments'
              ? 'border-[#714B67] text-[#714B67]'
              : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
          }`}
        >
          Department Allocations
        </button>
        <button
          onClick={() => setActiveTab('heatmap')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'heatmap'
              ? 'border-[#714B67] text-[#714B67]'
              : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
          }`}
        >
          Resource Booking Heatmap
        </button>
      </div>

      {/* Tab A: Utilization */}
      {activeTab === 'utilization' && utilization && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Summary KPIs */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-sm border border-[#E3E3E6] bg-white p-4">
              <h3 className="text-xs font-bold text-[#6C757D] uppercase tracking-wider">Utilization Rate</h3>
              <div className="text-3xl font-bold text-[#714B67] mt-2">
                {utilization.utilization_rate.toFixed(1)}%
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-[#714B67] h-full"
                  style={{ width: `${utilization.utilization_rate}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-[#6C757D] mt-2">
                Percentage of active assets currently in Allocated status.
              </p>
            </div>

            <div className="rounded-sm border border-[#E3E3E6] bg-white p-4 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#6C757D]">Lanes Status</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#6C757D]">Allocated</span>
                  <span className="font-semibold text-[#1F1F1F]">{utilization.allocated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6C757D]">Available</span>
                  <span className="font-semibold text-[#1F1F1F]">{utilization.available}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6C757D]">Under Maintenance</span>
                  <span className="font-semibold text-[#1F1F1F]">{utilization.maintenance}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SVG Visual Chart */}
          <div className="lg:col-span-2 rounded-sm border border-[#E3E3E6] bg-white p-4 flex flex-col justify-between">
            <h3 className="text-xs font-bold text-[#1F1F1F] uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <PieChart size={14} className="text-[#714B67]" /> Asset Allocation Spread
            </h3>
            {/* Visual SVG chart representation */}
            <div className="flex-1 flex items-center justify-center py-6">
              <svg width="240" height="120" viewBox="0 0 240 120" className="max-w-full">
                {/* Total */}
                <rect x="20" y="100" width="40" height="2" fill="#E3E3E6" />
                {/* Allocated */}
                <rect
                  x="70"
                  y={100 - (utilization.allocated / (utilization.total_assets || 1)) * 80}
                  width="40"
                  height={(utilization.allocated / (utilization.total_assets || 1)) * 80}
                  fill="#3B82F6"
                  rx="2"
                />
                {/* Available */}
                <rect
                  x="130"
                  y={100 - (utilization.available / (utilization.total_assets || 1)) * 80}
                  width="40"
                  height={(utilization.available / (utilization.total_assets || 1)) * 80}
                  fill="#28A745"
                  rx="2"
                />
                {/* Maintenance */}
                <rect
                  x="190"
                  y={100 - (utilization.maintenance / (utilization.total_assets || 1)) * 80}
                  width="40"
                  height={(utilization.maintenance / (utilization.total_assets || 1)) * 80}
                  fill="#FD7E14"
                  rx="2"
                />
                <line x1="10" y1="100" x2="230" y2="100" stroke="#E3E3E6" strokeWidth="2" />
              </svg>
            </div>
            <div className="flex justify-center gap-6 text-[10px] text-[#6C757D]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[#3B82F6]"></span> Allocated
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[#28A745]"></span> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[#FD7E14]"></span> Maintenance
              </span>
            </div>
          </div>

          {/* Most-used vs Idle (brief: "most-used vs. idle assets") */}
          <div className="lg:col-span-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} className="text-[#714B67]" /> Most-Used Assets
              </h3>
              <DataTable
                columns={[
                  { header: 'Tag', accessor: (row: RankedAsset) => <span className="font-semibold">{row.tag}</span> },
                  { header: 'Name', accessor: (row: RankedAsset) => row.name },
                  { header: 'Allocations + Bookings', accessor: (row: RankedAsset) => row.usage_count },
                ]}
                data={utilization.most_used}
                emptyMessage="Not enough data yet."
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#1F1F1F] uppercase tracking-wider">
                Idle Assets (unused {utilization.idle_threshold_days}+ days)
              </h3>
              <DataTable
                columns={[
                  { header: 'Tag', accessor: (row: RankedAsset) => <span className="font-semibold">{row.tag}</span> },
                  { header: 'Name', accessor: (row: RankedAsset) => row.name },
                  {
                    header: 'Last Used',
                    accessor: (row: RankedAsset) =>
                      row.last_used_at ? new Date(row.last_used_at).toLocaleDateString() : 'Never',
                  },
                ]}
                data={utilization.idle_assets}
                emptyMessage="No idle assets — everything is in use."
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab B: Depreciation */}
      {activeTab === 'depreciation' && (
        <DataTable
          columns={[
            { header: 'Asset Tag', accessor: (row) => <span className="font-semibold">{row.tag}</span> },
            { header: 'Asset Name', accessor: (row) => row.name },
            {
              header: 'Acquisition Cost',
              accessor: (row) => (row.acquisition_cost ? `$${row.acquisition_cost.toFixed(2)}` : '—'),
            },
            { header: 'Current Value (Depreciated)', accessor: (row) => `$${row.current_value.toFixed(2)}` },
            {
              header: 'Total Depreciation',
              accessor: (row) =>
                row.acquisition_cost ? `$${(row.acquisition_cost - row.current_value).toFixed(2)}` : '—',
            },
          ]}
          data={depreciation}
        />
      )}

      {/* Tab C: Maintenance Frequency */}
      {activeTab === 'maintenance' && (
        <DataTable
          columns={[
            { header: 'Asset Tag', accessor: (row) => <span className="font-semibold">{row.tag}</span> },
            { header: 'Asset Name', accessor: (row) => row.name },
            {
              header: 'Total Maintenance Occurrences',
              accessor: (row) => (
                <div className="flex items-center gap-2">
                  <Wrench size={12} className="text-[#FD7E14]" />
                  <span className="font-semibold">{row.count} times</span>
                </div>
              ),
            },
          ]}
          data={getMaintenanceFrequency()}
          emptyMessage="No maintenance request history found."
        />
      )}

      {/* Tab D: Department Summaries */}
      {activeTab === 'departments' && (
        <DataTable
          columns={[
            { header: 'Department', accessor: (row) => row.name },
            { header: 'Active Allocated Assets', accessor: (row) => row.count },
            { header: 'Total Value Held', accessor: (row) => `$${row.value.toFixed(2)}` },
          ]}
          data={getDepartmentSummaries()}
          emptyMessage="No active allocations recorded."
        />
      )}

      {/* Tab E: Heatmap */}
      {activeTab === 'heatmap' && (
        <div className="bg-white border border-[#E3E3E6] rounded-sm p-4 overflow-x-auto space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1F1F1F]">
            <Calendar size={14} className="text-[#714B67]" /> Resource Booking Slots Intensity
          </div>

          <div className="min-w-[640px] grid grid-cols-25 gap-1 border-t border-[#E3E3E6] pt-4">
            {/* Header label */}
            <div className="col-span-1 text-[9px] text-[#6C757D] font-bold"></div>
            {Array(24)
              .fill(0)
              .map((_, h) => (
                <div key={h} className="text-[9px] text-[#6C757D] font-bold text-center">
                  {h}h
                </div>
              ))}

            {/* Grid rows */}
            {getBookingHeatmap().map((row, dayIdx) => (
              <React.Fragment key={dayIdx}>
                <div className="col-span-1 text-[9px] text-[#6C757D] font-bold flex items-center pr-2">
                  {daysOfWeek[dayIdx].substring(0, 3)}
                </div>
                {row.map((count, hourIdx) => {
                  let intensity = 'bg-gray-50';
                  if (count > 0 && count <= 2) intensity = 'bg-[#714B67]/20';
                  else if (count > 2 && count <= 5) intensity = 'bg-[#714B67]/55 text-white';
                  else if (count > 5) intensity = 'bg-[#714B67] text-white';

                  return (
                    <div
                      key={hourIdx}
                      className={`h-6 w-full rounded-sm flex items-center justify-center text-[9px] border border-white font-medium ${intensity}`}
                      title={`${daysOfWeek[dayIdx]} ${hourIdx}:00 — ${count} bookings`}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-4 text-[10px] text-[#6C757D] justify-end pt-2">
            <span>Low Intensity</span>
            <div className="h-4 w-4 bg-gray-50 border border-gray-200 rounded-sm"></div>
            <div className="h-4 w-4 bg-[#714B67]/20 rounded-sm"></div>
            <div className="h-4 w-4 bg-[#714B67]/55 rounded-sm"></div>
            <div className="h-4 w-4 bg-[#714B67] rounded-sm"></div>
            <span>High Intensity</span>
          </div>
        </div>
      )}
    </div>
  );
}
