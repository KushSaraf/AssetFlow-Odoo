'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import { Check, CheckSquare, Bell, History } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  payload: {
    message: string;
    actorName?: string;
  };
  read_at: string | null;
  created_at: string;
}

type TabType = 'notifications' | 'activity';

export default function NotificationsPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('notifications');
  const [filter, setFilter] = useState<'all' | 'unread' | 'alerts' | 'bookings'>('all');

  // Fetch Notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch('/notifications'),
  });

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast('Notification marked as read.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiFetch('/notifications/read-all', { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast('All notifications marked as read.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  // Filter logic
  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read_at;
    if (filter === 'alerts') return n.type === 'AssetOverdue' || n.type === 'AuditDiscrepancy';
    if (filter === 'bookings') return n.type.startsWith('Booking');
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1F1F1F]">Activity Logs & Notifications</h1>
          <p className="text-xs text-[#6C757D] mt-0.5">Stay up-to-date with allocations, bookings, and system triggers.</p>
        </div>
        {activeTab === 'notifications' && unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="flex items-center gap-1.5 rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53] transition-colors self-start sm:self-auto"
          >
            <CheckSquare size={14} />
            Mark All as Read
          </button>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-[#E3E3E6]">
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'notifications'
              ? 'border-[#714B67] text-[#714B67]'
              : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
          }`}
        >
          My Notifications ({unreadCount})
        </button>
        {role !== 'Employee' && (
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'activity'
                ? 'border-[#714B67] text-[#714B67]'
                : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
            }`}
          >
            System Activity Log
          </button>
        )}
      </div>

      {/* Tab A: My Notifications */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex gap-2 border-b border-gray-100 pb-2">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-sm px-2.5 py-1 text-xs transition-all ${
                filter === 'all' ? 'bg-[#714B67]/10 text-[#714B67] font-semibold' : 'text-[#6C757D] hover:text-[#1F1F1F]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`rounded-sm px-2.5 py-1 text-xs transition-all ${
                filter === 'unread' ? 'bg-[#714B67]/10 text-[#714B67] font-semibold' : 'text-[#6C757D] hover:text-[#1F1F1F]'
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setFilter('alerts')}
              className={`rounded-sm px-2.5 py-1 text-xs transition-all ${
                filter === 'alerts' ? 'bg-[#714B67]/10 text-[#714B67] font-semibold' : 'text-[#6C757D] hover:text-[#1F1F1F]'
              }`}
            >
              Alerts
            </button>
            <button
              onClick={() => setFilter('bookings')}
              className={`rounded-sm px-2.5 py-1 text-xs transition-all ${
                filter === 'bookings' ? 'bg-[#714B67]/10 text-[#714B67] font-semibold' : 'text-[#6C757D] hover:text-[#1F1F1F]'
              }`}
            >
              Bookings
            </button>
          </div>

          {/* List */}
          <div className="rounded-sm border border-[#E3E3E6] bg-white divide-y divide-[#E3E3E6]">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-xs text-[#6C757D]">Loading notifications...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#6C757D]">You have no notifications.</div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 p-4 transition-colors ${
                    !n.read_at ? 'bg-[#714B67]/5' : ''
                  }`}
                >
                  <Bell size={16} className={`shrink-0 mt-0.5 ${!n.read_at ? 'text-[#714B67]' : 'text-[#6C757D]'}`} />
                  <div className="flex-1 space-y-1">
                    <p className={`text-xs text-[#1F1F1F] leading-normal ${!n.read_at ? 'font-medium' : ''}`}>
                      {n.payload.message || `System Update: ${n.type}`}
                    </p>
                    <span className="text-[10px] text-[#6C757D] block">
                      {new Date(n.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {!n.read_at && (
                    <button
                      onClick={() => markReadMutation.mutate(n.id)}
                      className="text-[10px] text-[#714B67] border border-[#714B67]/30 px-1.5 py-0.5 rounded-sm hover:bg-[#714B67]/5 flex items-center gap-1 font-semibold"
                    >
                      <Check size={10} /> Mark Read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab B: System Activity Log */}
      {activeTab === 'activity' && (
        <DataTable
          columns={[
            { header: 'Trigger / Event Type', accessor: (row) => <span className="font-semibold text-xs text-[#714B67]">{row.type}</span> },
            { header: 'Action Details / Event Message', accessor: (row) => row.payload.message || `System Update: ${row.type}` },
            {
              header: 'Event Timestamp',
              accessor: (row) => (
                <div className="flex items-center gap-1.5">
                  <History size={12} className="text-[#6C757D]" />
                  <span>{new Date(row.created_at).toLocaleString()}</span>
                </div>
              ),
            },
          ]}
          // Display all notifications as system activity logs (since they represent all system-level updates)
          data={notifications}
          emptyMessage="No activity logs found."
        />
      )}
    </div>
  );
}
