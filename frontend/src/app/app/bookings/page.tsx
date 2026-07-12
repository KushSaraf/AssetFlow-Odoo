'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import Modal from '../../../components/Modal';
import { Calendar, Clock, Plus, Trash2, CalendarDays } from 'lucide-react';

interface BookableResource {
  id: string;
  tag: string;
  name: string;
  location: string | null;
}

interface Booking {
  id: string;
  asset_id: string;
  booked_by: string;
  on_behalf_of_department_id: string | null;
  start_time: string;
  end_time: string;
  purpose: string | null;
  status: string;
  booker: { name: string };
  asset: { name: string; tag: string };
}

interface Department {
  id: string;
  name: string;
}

export default function ResourceBookingPage() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Booking Form State
  const [bookingOpen, setBookingOpen] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [onBehalfDept, setOnBehalfDept] = useState('');
  const [overlapError, setOverlapError] = useState<string | null>(null);

  // Fetch Bookable Resources
  const { data: resources = [] } = useQuery<BookableResource[]>({
    queryKey: ['bookable-resources'],
    queryFn: () => apiFetch('/bookings/resources'),
  });

  React.useEffect(() => {
    if (resources.length > 0 && !selectedResourceId) {
      setSelectedResourceId(resources[0].id);
    }
  }, [resources, selectedResourceId]);

  // Fetch Bookings for selected resource & date
  const bookingsQueryUrl = selectedResourceId
    ? `/bookings?asset_id=${selectedResourceId}&date=${selectedDate}`
    : `/bookings?date=${selectedDate}`;

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['bookings', selectedResourceId, selectedDate],
    queryFn: () => apiFetch(bookingsQueryUrl),
    enabled: !!selectedResourceId || !!selectedDate,
  });

  // Fetch Departments for book-on-behalf
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => apiFetch('/departments'),
    enabled: role === 'Department Head' || role === 'Admin',
  });

  // Mutation Create Booking
  const createBookingMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/bookings', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setBookingOpen(false);
      toast('Slot booked successfully!');
    },
    onError: (err: any) => {
      if (err instanceof ApiError && err.code === 'overlap') {
        const conflict = err.meta?.conflicting_booking;
        const confStart = conflict ? new Date(conflict.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const confEnd = conflict ? new Date(conflict.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const resourceName = resources.find((r) => r.id === selectedResourceId)?.name || 'Resource';

        const errMsg = `${resourceName} is booked ${confStart}–${confEnd}. Your request for ${new Date(
          `2000-01-01T${startTime}`
        ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${new Date(
          `2000-01-01T${endTime}`
        ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} overlaps and cannot be booked. A request starting after ${confEnd} would be accepted since it ends/starts exactly at the boundary.`;

        setOverlapError(errMsg);
      } else {
        toast(err.message, 'error');
      }
    },
  });

  // Mutation Cancel Booking
  const cancelBookingMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/bookings/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast('Booking cancelled successfully.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const handleOpenBooking = () => {
    setOverlapError(null);
    setStartTime('');
    setEndTime('');
    setPurpose('');
    setOnBehalfDept('');
    setBookingOpen(true);
  };

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime || !endTime) return;

    const startDateTime = new Date(`${selectedDate}T${startTime}`);
    const endDateTime = new Date(`${selectedDate}T${endTime}`);

    if (endDateTime <= startDateTime) {
      toast('End time must be after start time.', 'error');
      return;
    }

    setOverlapError(null);
    createBookingMutation.mutate({
      asset_id: selectedResourceId,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      purpose: purpose || undefined,
      on_behalf_of_department_id: onBehalfDept || undefined,
    });
  };

  const selectedResource = resources.find((r) => r.id === selectedResourceId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1F1F1F]">Resource Booking</h1>
          <p className="text-xs text-[#6C757D] mt-0.5">Schedule shared equipment, rooms, and company vehicles.</p>
        </div>
        {selectedResourceId && (
          <button
            onClick={handleOpenBooking}
            className="flex items-center gap-1.5 rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53] transition-colors self-start sm:self-auto"
          >
            <Plus size={14} />
            Book a Slot
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {/* Left Side: Resources list */}
        <div className="rounded-sm border border-[#E3E3E6] bg-white p-3 space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#6C757D]">Shared Resources</h3>
          <div className="space-y-1">
            {resources.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#6C757D]">No bookable resources.</div>
            ) : (
              resources.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedResourceId(r.id)}
                  className={`flex w-full flex-col rounded-sm p-2.5 text-left border transition-all ${
                    selectedResourceId === r.id
                      ? 'border-[#714B67] bg-[#714B67]/5 text-[#714B67]'
                      : 'border-transparent text-[#6C757D] hover:bg-[#F7F7F8] hover:text-[#1F1F1F]'
                  }`}
                >
                  <span className="text-xs font-semibold">{r.name}</span>
                  <span className="text-[10px] text-[#6C757D] mt-0.5">
                    {r.tag} {r.location ? `• ${r.location}` : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Timeline View & Bookings */}
        <div className="md:col-span-3 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white border border-[#E3E3E6] rounded-sm p-3">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-[#714B67]" />
              <span className="text-xs font-semibold text-[#1F1F1F]">
                {selectedResource?.name || 'Select a resource'} Timeline
              </span>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-sm border border-[#E3E3E6] px-2 py-1 text-xs outline-none bg-white max-w-[150px]"
            />
          </div>

          <div className="bg-white border border-[#E3E3E6] rounded-sm p-4 space-y-4">
            {/* Custom Interactive Booking Slots Timeline */}
            <div className="relative border-l border-gray-200 ml-4 py-2 space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#6C757D] pl-4 mb-2">Daily Schedule</h3>

              {bookingsLoading ? (
                <div className="pl-4 py-8 text-xs text-[#6C757D]">Loading timeline...</div>
              ) : bookings.filter((b) => b.status !== 'Cancelled').length === 0 ? (
                <div className="pl-4 py-8 text-xs text-[#6C757D] italic">No active bookings scheduled for this date.</div>
              ) : (
                bookings
                  .filter((b) => b.status !== 'Cancelled')
                  .map((b) => {
                    const startLocal = new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const endLocal = new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const isOwn = b.booked_by === user?.id;

                    return (
                      <div key={b.id} className="relative pl-6">
                        {/* Timeline node */}
                        <div className="absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full border border-white bg-[#714B67]"></div>

                        <div className="flex items-start justify-between border border-[#E3E3E6] rounded-sm bg-gray-50/50 p-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[#1F1F1F]">
                              <Clock size={12} className="text-[#6C757D]" />
                              {startLocal} – {endLocal}
                            </div>
                            <div className="text-[11px] text-[#6C757D]">
                              Booked by <span className="font-medium text-[#1F1F1F]">{b.booker.name}</span>
                              {b.purpose ? ` for "${b.purpose}"` : ''}
                            </div>
                          </div>

                          {(isOwn || role === 'Admin' || role === 'Asset Manager') && (
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to cancel this booking?')) {
                                  cancelBookingMutation.mutate(b.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded-sm"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Book Slot Modal */}
      <Modal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        title={selectedResource ? `Book Slot for ${selectedResource.name}` : 'Book a Slot'}
        footer={
          <>
            <button
              onClick={() => setBookingOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateBooking}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Confirm Booking
            </button>
          </>
        }
      >
        <form className="space-y-4">
          {overlapError && (
            <div className="rounded-sm border border-red-200 bg-red-50 p-3 text-xs text-red-800 leading-relaxed font-medium">
              {overlapError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Purpose / Notes
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
              placeholder="e.g. Design review meeting"
            />
          </div>

          {(role === 'Admin' || role === 'Department Head') && (
            <div>
              <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                Book on behalf of
              </label>
              <select
                value={onBehalfDept}
                onChange={(e) => setOnBehalfDept(e.target.value)}
                className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none bg-white"
              >
                <option value="">Myself (Personal)</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
