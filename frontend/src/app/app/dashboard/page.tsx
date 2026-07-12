'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import StatCard from '../../../components/StatCard';
import StatusBadge from '../../../components/StatusBadge';
import { AlertCircle, Calendar, PlusCircle, Wrench } from 'lucide-react';

interface DashboardKpis {
  totalAssets: number;
  myAllocations: number;
  pendingMaintenance: number;
  openAudits: number;
}

interface Allocation {
  id: string;
  asset: {
    id: string;
    tag: string;
    name: string;
  };
  employee?: {
    name: string;
  };
  department?: {
    name: string;
  };
  expected_return_date: string | null;
  allocated_at: string;
}

interface Notification {
  id: string;
  type: string;
  payload: {
    message: string;
  };
  created_at: string;
}

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  purpose: string | null;
  status: string;
  asset: { name: string; tag: string };
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, role } = useAuth();

  // Fetch KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery<DashboardKpis>({
    queryKey: ['dashboard-kpis'],
    queryFn: () => apiFetch('/dashboard'),
    enabled: !!user,
  });

  // Fetch Overdue Allocations
  const { data: overdueAllocations = [], isLoading: overdueLoading } = useQuery<Allocation[]>({
    queryKey: ['overdue-allocations'],
    queryFn: () => apiFetch('/allocations?overdue=true'),
    enabled: !!user,
  });

  // Fetch Notifications (Recent Activity)
  const { data: notifications = [], isLoading: activityLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch('/notifications'),
    enabled: !!user,
  });

  // Fetch Upcoming Bookings
  const { data: upcomingBookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['upcoming-bookings'],
    queryFn: () => apiFetch('/bookings?my_bookings=true&upcoming=true'),
    enabled: !!user,
  });

  const getKpiValue = (val: number | undefined) => {
    if (kpisLoading) return '...';
    return val !== undefined ? val : 0;
  };

  const handleQuickAction = (action: string) => {
    if (action === 'register') {
      router.push('/app/assets?action=register');
    } else if (action === 'book') {
      router.push('/app/bookings');
    } else if (action === 'maintenance') {
      router.push('/app/maintenance');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1F1F1F]">Good morning, {user?.name}</h1>
        <p className="text-xs text-[#6C757D] mt-0.5">Here is your operational snapshot for today.</p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          count={getKpiValue(kpis?.totalAssets)}
          label="Total Assets Registered"
          onClick={() => router.push('/app/assets')}
        />
        <StatCard
          count={getKpiValue(kpis?.myAllocations)}
          label="My Active Allocations"
          onClick={() => router.push('/app/allocations')}
        />
        <StatCard
          count={getKpiValue(kpis?.pendingMaintenance)}
          label="Pending Maintenance Requests"
          onClick={() => router.push('/app/maintenance')}
        />
        <StatCard
          count={getKpiValue(kpis?.openAudits)}
          label="Active Audit Cycles"
          onClick={() => router.push('/app/audit')}
        />
      </div>

      {/* Two Column Body */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Overdue + Upcoming */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overdue Panel */}
          <div className="rounded-sm border border-[#E3E3E6] bg-white">
            <div className="border-b border-[#E3E3E6] bg-white px-4 py-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#1F1F1F] uppercase tracking-wider flex items-center gap-2">
                <AlertCircle size={14} className="text-[#DC3545]" />
                Overdue Return Items
              </h2>
              <span className="rounded-full bg-red-50 text-red-600 px-2.5 py-0.5 text-[10px] font-bold">
                {overdueAllocations.length} items
              </span>
            </div>

            <div className="divide-y divide-[#E3E3E6] max-h-64 overflow-y-auto">
              {overdueLoading ? (
                <div className="px-4 py-8 text-center text-xs text-[#6C757D]">Loading...</div>
              ) : overdueAllocations.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-[#6C757D]">
                  No items currently overdue for return.
                </div>
              ) : (
                overdueAllocations.map((alloc) => (
                  <div
                    key={alloc.id}
                    onClick={() => router.push(`/app/allocations?id=${alloc.id}`)}
                    className="flex items-center justify-between border-l-4 border-l-[#DC3545] p-3 hover:bg-[#F7F7F8] cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-semibold text-[#1F1F1F]">
                        {alloc.asset.name} ({alloc.asset.tag})
                      </div>
                      <div className="text-[10px] text-[#6C757D] mt-0.5">
                        Held by {alloc.employee?.name || alloc.department?.name || 'Unknown'} — Allocated on{' '}
                        {new Date(alloc.allocated_at).toLocaleDateString()}
                      </div>
                    </div>
                    {alloc.expected_return_date && (
                      <span className="text-[10px] font-semibold text-[#DC3545]">
                        Due {new Date(alloc.expected_return_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Bookings Panel */}
          <div className="rounded-sm border border-[#E3E3E6] bg-white">
            <div className="border-b border-[#E3E3E6] bg-white px-4 py-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#1F1F1F] uppercase tracking-wider flex items-center gap-2">
                <Calendar size={14} className="text-[#714B67]" />
                My Upcoming Bookings
              </h2>
              <span className="rounded-full bg-[#714B67]/10 text-[#714B67] px-2.5 py-0.5 text-[10px] font-bold">
                {upcomingBookings.length} upcoming
              </span>
            </div>

            <div className="divide-y divide-[#E3E3E6] max-h-64 overflow-y-auto">
              {bookingsLoading ? (
                <div className="px-4 py-8 text-center text-xs text-[#6C757D]">Loading...</div>
              ) : upcomingBookings.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-[#6C757D]">
                  No upcoming bookings scheduled.
                </div>
              ) : (
                upcomingBookings.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => router.push(`/app/bookings`)}
                    className="flex items-center justify-between p-3 hover:bg-[#F7F7F8] cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-semibold text-[#1F1F1F]">
                        {b.asset.name} ({b.asset.tag})
                      </div>
                      <div className="text-[10px] text-[#6C757D] mt-0.5">
                        {new Date(b.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} – {new Date(b.end_time).toLocaleTimeString([], { timeStyle: 'short' })}
                        {b.purpose ? ` • ${b.purpose}` : ''}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="rounded-sm border border-[#E3E3E6] bg-white p-4">
            <h2 className="text-xs font-semibold text-[#1F1F1F] uppercase tracking-wider mb-3">Quick Actions</h2>
            <div className="flex flex-wrap gap-3">
              {(role === 'Admin' || role === 'Asset Manager') && (
                <button
                  onClick={() => handleQuickAction('register')}
                  className="flex items-center gap-2 rounded-sm border border-[#714B67] bg-[#714B67] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5B3B53] transition-colors"
                >
                  <PlusCircle size={14} />
                  Register Asset
                </button>
              )}
              <button
                onClick={() => handleQuickAction('book')}
                className="flex items-center gap-2 rounded-sm border border-[#E3E3E6] bg-white px-4 py-2 text-xs font-semibold text-[#1F1F1F] hover:bg-[#F7F7F8] transition-colors"
              >
                <Calendar size={14} />
                Book Resource
              </button>
              <button
                onClick={() => handleQuickAction('maintenance')}
                className="flex items-center gap-2 rounded-sm border border-[#E3E3E6] bg-white px-4 py-2 text-xs font-semibold text-[#1F1F1F] hover:bg-[#F7F7F8] transition-colors"
              >
                <Wrench size={14} />
                Raise Maintenance Request
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="rounded-sm border border-[#E3E3E6] bg-white">
          <div className="border-b border-[#E3E3E6] bg-white px-4 py-3">
            <h2 className="text-xs font-semibold text-[#1F1F1F] uppercase tracking-wider">Recent Activity</h2>
          </div>

          <div className="divide-y divide-[#E3E3E6] max-h-[384px] overflow-y-auto">
            {activityLoading ? (
              <div className="px-4 py-8 text-center text-xs text-[#6C757D]">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#6C757D]">No recent activity.</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="p-3 text-xs">
                  <div className="text-[#1F1F1F] leading-normal">
                    {n.payload.message || `System Update: ${n.type}`}
                  </div>
                  <div className="mt-1 text-[10px] text-[#6C757D]">
                    {new Date(n.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
