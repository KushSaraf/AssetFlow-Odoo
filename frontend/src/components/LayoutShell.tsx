'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import {
  LayoutDashboard,
  Building2,
  FolderTree,
  ArrowLeftRight,
  CalendarDays,
  Wrench,
  ClipboardCheck,
  BarChart3,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  History
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  payload: {
    message: string;
  };
  read_at: string | null;
  created_at: string;
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const { user, logout, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Fetch notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch('/notifications'),
    enabled: !!user,
    refetchInterval: 10000, // Poll every 10s
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markAllReadMutation = useMutation({
    mutationFn: () => apiFetch('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  if (!user) return null;

  // Define navigation items based on Role Matrix
  const navItems = [
    { name: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard, roles: ['Admin', 'Asset Manager', 'Department Head', 'Employee'] },
    { name: 'Org Setup', path: '/app/org-setup', icon: Building2, roles: ['Admin'] },
    { name: 'Assets', path: '/app/assets', icon: FolderTree, roles: ['Admin', 'Asset Manager', 'Department Head', 'Employee'] },
    { name: 'Allocations & Transfers', path: '/app/allocations', icon: ArrowLeftRight, roles: ['Admin', 'Asset Manager', 'Department Head', 'Employee'] },
    { name: 'Resource Booking', path: '/app/bookings', icon: CalendarDays, roles: ['Admin', 'Asset Manager', 'Department Head', 'Employee'] },
    { name: 'Maintenance', path: '/app/maintenance', icon: Wrench, roles: ['Admin', 'Asset Manager', 'Department Head', 'Employee'] },
    { name: 'Audit', path: '/app/audit', icon: ClipboardCheck, roles: ['Admin', 'Asset Manager', 'Department Head'] },
    { name: 'Reports', path: '/app/reports', icon: BarChart3, roles: ['Admin', 'Asset Manager', 'Department Head'] },
    { name: 'Activity & Notifications', path: '/app/notifications', icon: History, roles: ['Admin', 'Asset Manager', 'Department Head', 'Employee'] },
  ];

  const filteredNavItems = navItems.filter((item) => item.roles.includes(role || ''));

  // Get Breadcrumb info
  const getBreadcrumb = () => {
    const currentItem = navItems.find((item) => pathname.startsWith(item.path));
    if (!currentItem) return 'AssetFlow';
    return `AssetFlow / ${currentItem.name}`;
  };

  const handleNotificationClick = (n: Notification) => {
    markReadMutation.mutate(n.id);
    setShowBellDropdown(false);
    router.push('/app/notifications');
  };

  return (
    <div className="flex min-h-screen bg-[#F7F7F8]">
      {/* Sidebar Nav */}
      <aside
        className={`flex flex-col border-r border-[#E3E3E6] bg-white transition-all duration-200 ${
          isCollapsed ? 'w-14' : 'w-[220px]'
        }`}
      >
        {/* Brand / Logo */}
        <div className="flex h-12 items-center justify-between border-b border-[#E3E3E6] px-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#714B67] text-sm font-bold text-white">
              AF
            </span>
            {!isCollapsed && <span className="text-sm font-semibold text-[#1F1F1F]">AssetFlow</span>}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded-sm p-1 text-[#6C757D] hover:bg-[#F7F7F8] hover:text-[#1F1F1F]"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 p-2">
          {filteredNavItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`flex w-full items-center gap-3 rounded-sm py-2 px-3 text-left transition-colors ${
                  isActive
                    ? 'border-l-[3px] border-[#714B67] bg-[#714B67]/5 font-semibold text-[#714B67]'
                    : 'text-[#6C757D] hover:bg-[#F7F7F8] hover:text-[#1F1F1F]'
                }`}
              >
                <Icon size={16} />
                {!isCollapsed && <span className="text-xs">{item.name}</span>}
              </button>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="border-t border-[#E3E3E6] p-2">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-sm py-2 px-3 text-[#6C757D] hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} />
            {!isCollapsed && <span className="text-xs">Log Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top App Bar */}
        <header className="flex h-12 items-center justify-between border-b border-[#E3E3E6] bg-white px-4">
          {/* Breadcrumb */}
          <div className="text-xs font-medium text-[#6C757D]">{getBreadcrumb()}</div>

          {/* Actions & Profile */}
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowBellDropdown(!showBellDropdown);
                  setShowProfileDropdown(false);
                }}
                className="relative rounded-sm p-1.5 text-[#6C757D] hover:bg-[#F7F7F8] hover:text-[#1F1F1F]"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showBellDropdown && (
                <div className="absolute right-0 mt-1 w-80 rounded-md border border-[#E3E3E6] bg-white py-1 shadow-lg z-50">
                  <div className="flex items-center justify-between border-b border-[#E3E3E6] px-3 py-2">
                    <span className="text-xs font-semibold text-[#1F1F1F]">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllReadMutation.mutate()}
                        className="text-[10px] text-[#714B67] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-[#6C757D]">
                        You're all caught up.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`border-b border-[#F7F7F8] px-3 py-2 hover:bg-[#F7F7F8] cursor-pointer text-xs ${
                            !n.read_at ? 'bg-[#714B67]/5 font-medium' : 'text-[#6C757D]'
                          }`}
                        >
                          <div className="line-clamp-2">{n.payload.message}</div>
                          <div className="mt-1 text-[10px] text-[#6C757D]">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowProfileDropdown(!showProfileDropdown);
                  setShowBellDropdown(false);
                }}
                className="flex items-center gap-2 rounded-sm p-1 text-[#6C757D] hover:bg-[#F7F7F8] hover:text-[#1F1F1F]"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#714B67]/10 text-xs font-bold text-[#714B67]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-[#1F1F1F] max-w-[120px] truncate">{user.name}</span>
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-1 w-48 rounded-md border border-[#E3E3E6] bg-white py-1 shadow-lg z-50">
                  <div className="border-b border-[#E3E3E6] px-4 py-2 text-xs">
                    <div className="font-semibold text-[#1F1F1F]">{user.name}</div>
                    <div className="text-[10px] text-[#6C757D]">{user.role}</div>
                  </div>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={14} />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 flex flex-col overflow-y-auto p-6">
          {user.department_id === null && role !== 'Admin' && (
            <div className="mb-4 rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center justify-between">
              <span>You haven't been assigned to a department yet — contact your Admin.</span>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
