'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import KanbanBoard from '../../../components/KanbanBoard';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import Modal from '../../../components/Modal';
import { Plus, Kanban, List, AlertTriangle, User, Check, X, Play, ShieldAlert } from 'lucide-react';

interface MaintenanceRequest {
  id: string;
  asset_id: string;
  raised_by: string;
  issue: string;
  priority: string;
  status: string;
  technician: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  asset: { tag: string; name: string; status: string };
  raiser: { name: string };
}

interface Asset {
  id: string;
  tag: string;
  name: string;
  status: string;
}

export default function MaintenancePage() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Dialog states
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [assetId, setAssetId] = useState('');
  const [issue, setIssue] = useState('');
  const [priority, setPriority] = useState('Medium');

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);

  // Action input states
  const [techName, setTechName] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveOpen, setResolveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch Requests
  const { data: requests = [], isLoading } = useQuery<MaintenanceRequest[]>({
    queryKey: ['maintenance-requests'],
    queryFn: () => apiFetch('/maintenance-requests'),
  });

  // Fetch Assets (filtered based on role)
  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: () => apiFetch('/assets'),
  });

  // Allowed assets to raise request against
  const allocAssets = assets.filter((a) => {
    if (role === 'Admin' || role === 'Asset Manager') return true;
    return a.status === 'Allocated'; // simplified for employee/head
  });

  // Mutations
  const raiseMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/maintenance-requests', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      setRaiseOpen(false);
      setIssue('');
      setAssetId('');
      toast('Maintenance request raised successfully!');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/maintenance-requests/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setDetailsOpen(false);
      toast('Request Approved! Asset status is now Under Maintenance.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/maintenance-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      setRejectOpen(false);
      setDetailsOpen(false);
      toast('Request Rejected.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const assignTechMutation = useMutation({
    mutationFn: ({ id, technician }: { id: string; technician: string }) =>
      apiFetch(`/maintenance-requests/${id}/assign-technician`, { method: 'POST', body: JSON.stringify({ technician }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      setAssignOpen(false);
      setDetailsOpen(false);
      toast('Technician assigned successfully.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/maintenance-requests/${id}/start`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      setDetailsOpen(false);
      toast('Work started on this request.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      apiFetch(`/maintenance-requests/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution_notes: notes }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setResolveOpen(false);
      setDetailsOpen(false);
      toast('Maintenance resolved! Asset reverted to Available/Allocated.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  // Kanban lanes mapping
  const kanbanColumns = [
    { id: 'Pending', name: 'Pending Approval' },
    { id: 'Approved', name: 'Approved' },
    { id: 'Technician Assigned', name: 'Technician Assigned' },
    { id: 'In Progress', name: 'In Progress' },
    { id: 'Resolved', name: 'Resolved' },
    { id: 'Rejected', name: 'Rejected' },
  ];

  const handleCardDrop = (reqId: string, targetColId: string) => {
    if (role !== 'Admin' && role !== 'Asset Manager') {
      toast('Only Asset Managers can drag cards to advance maintenance workflows.', 'error');
      return;
    }

    const reqObj = requests.find((r) => r.id === reqId);
    if (!reqObj) return;

    // State machine check
    if (targetColId === 'Approved' && reqObj.status === 'Pending') {
      approveMutation.mutate(reqId);
    } else if (targetColId === 'Rejected' && reqObj.status === 'Pending') {
      setSelectedRequest(reqObj);
      setRejectReason('');
      setRejectOpen(true);
    } else if (targetColId === 'Technician Assigned' && (reqObj.status === 'Approved' || reqObj.status === 'Pending')) {
      setSelectedRequest(reqObj);
      setTechName('');
      setAssignOpen(true);
    } else if (targetColId === 'In Progress' && reqObj.status === 'Technician Assigned') {
      startMutation.mutate(reqId);
    } else if (targetColId === 'Resolved' && reqObj.status === 'In Progress') {
      setSelectedRequest(reqObj);
      setResolveNotes('');
      setResolveOpen(true);
    } else {
      toast('Invalid workflow stage transition.', 'error');
    }
  };

  const handleRaiseRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId || !issue) return;
    raiseMutation.mutate({ asset_id: assetId, issue, priority });
  };

  const handleOpenDetails = (req: MaintenanceRequest) => {
    setSelectedRequest(req);
    setDetailsOpen(true);
  };

  return (
    <div className="flex flex-col flex-1 space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[#1F1F1F]">Maintenance Management</h1>
          <p className="text-xs text-[#6C757D] mt-0.5">Track machine repairs, diagnostics, and routine equipment servicing.</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-sm border border-[#E3E3E6] bg-white p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-sm transition-all ${
                viewMode === 'kanban' ? 'bg-[#714B67]/10 text-[#714B67]' : 'text-[#6C757D] hover:text-[#1F1F1F]'
              }`}
            >
              <Kanban size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-sm transition-all ${
                viewMode === 'list' ? 'bg-[#714B67]/10 text-[#714B67]' : 'text-[#6C757D] hover:text-[#1F1F1F]'
              }`}
            >
              <List size={14} />
            </button>
          </div>

          <button
            onClick={() => setRaiseOpen(true)}
            className="flex items-center gap-1.5 rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53] transition-colors"
          >
            <Plus size={14} />
            Raise Request
          </button>
        </div>
      </div>

      {/* Critical Trigger Side Effect Warning */}
      <div className="rounded-sm border border-[#714B67]/20 bg-[#714B67]/5 px-3 py-2 text-[11px] text-[#714B67] font-medium shrink-0">
        ⚠️ <strong>Workflow Triggers:</strong> Approving moves the asset to <strong>Under Maintenance</strong>; resolving
        returns it to its prior allocation status or Available.
      </div>

      {/* Kanban Board Mode */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'kanban' ? (
          <KanbanBoard
          columns={kanbanColumns}
          items={requests}
          getColId={(item) => item.status}
          getItemId={(item) => item.id}
          onCardDrop={handleCardDrop}
          renderCard={(item) => (
            <div onClick={() => handleOpenDetails(item)} className="space-y-2 cursor-pointer">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-xs text-[#1F1F1F]">
                  {item.asset.name} ({item.asset.tag})
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${
                    item.priority === 'Critical'
                      ? 'bg-red-100 text-red-700'
                      : item.priority === 'High'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {item.priority}
                </span>
              </div>
              <p className="text-[11px] text-[#6C757D] line-clamp-2">{item.issue}</p>
              <div className="flex items-center justify-between text-[10px] text-[#6C757D] pt-1 border-t border-[#F7F7F8]">
                <span>Raised by: {item.raiser.name}</span>
                {item.technician && <span className="italic font-medium">Tech: {item.technician}</span>}
              </div>
            </div>
          )}
        />
      ) : (
        <DataTable
          columns={[
            { header: 'Asset Tag', accessor: (row) => <span className="font-semibold">{row.asset.tag}</span> },
            { header: 'Asset Name', accessor: (row) => row.asset.name },
            { header: 'Issue Description', accessor: (row) => row.issue },
            { header: 'Priority', accessor: (row) => row.priority },
            { header: 'Status', accessor: (row) => <StatusBadge status={row.status} /> },
            { header: 'Technician Assigned', accessor: (row) => row.technician || 'Unassigned' },
            { header: 'Raised By', accessor: (row) => row.raiser.name },
          ]}
          data={requests}
          onRowClick={handleOpenDetails}
          emptyMessage="No maintenance requests raised yet."
        />
      )}
      </div>

      {/* Raise Request Modal */}
      <Modal
        isOpen={raiseOpen}
        onClose={() => setRaiseOpen(false)}
        title="Raise Maintenance Request"
        footer={
          <>
            <button
              onClick={() => setRaiseOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRaiseRequest}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Submit Request
            </button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Select Asset <span className="text-red-500">*</span>
            </label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none bg-white"
            >
              <option value="">Select an asset...</option>
              {allocAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} ({asset.tag}) — {asset.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Priority Urgency <span className="text-red-500">*</span>
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none bg-white"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Detailed Issue Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67] h-20 resize-none"
              placeholder="Describe the issue or error details."
              required
            />
          </div>
        </form>
      </Modal>

      {/* Details View / Actions Modal */}
      <Modal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Maintenance Request Details"
        footer={
          selectedRequest && (role === 'Admin' || role === 'Asset Manager') ? (
            <div className="flex gap-2 w-full justify-between items-center">
              <div className="flex gap-2">
                {selectedRequest.status === 'Pending' && (
                  <>
                    <button
                      onClick={() => approveMutation.mutate(selectedRequest.id)}
                      className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
                    >
                      Approve Request
                    </button>
                    <button
                      onClick={() => {
                        setRejectReason('');
                        setRejectOpen(true);
                      }}
                      className="rounded-sm border border-red-200 text-red-600 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-red-50"
                    >
                      Reject Request
                    </button>
                  </>
                )}
                {(selectedRequest.status === 'Approved' || selectedRequest.status === 'Pending') && (
                  <button
                    onClick={() => {
                      setTechName('');
                      setAssignOpen(true);
                    }}
                    className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50 flex items-center gap-1"
                  >
                    <User size={12} /> Assign Tech
                  </button>
                )}
                {selectedRequest.status === 'Technician Assigned' && (
                  <button
                    onClick={() => startMutation.mutate(selectedRequest.id)}
                    className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-green-700 hover:bg-green-50 flex items-center gap-1 font-medium"
                  >
                    <Play size={12} /> Start Work
                  </button>
                )}
                {selectedRequest.status === 'In Progress' && (
                  <button
                    onClick={() => {
                      setResolveNotes('');
                      setResolveOpen(true);
                    }}
                    className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-green-700 hover:bg-green-50 flex items-center gap-1 font-medium"
                  >
                    <Check size={12} /> Resolve
                  </button>
                )}
              </div>
              <button
                onClick={() => setDetailsOpen(false)}
                className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F]"
              >
                Close
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDetailsOpen(false)}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Close
            </button>
          )
        }
      >
        {selectedRequest && (
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#E3E3E6] pb-2">
              <span className="font-semibold text-sm text-[#1F1F1F]">
                {selectedRequest.asset.name} ({selectedRequest.asset.tag})
              </span>
              <StatusBadge status={selectedRequest.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[10px] font-semibold text-[#6C757D] uppercase">Priority</span>
                <span className="text-[#1F1F1F] font-semibold">{selectedRequest.priority}</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-[#6C757D] uppercase">Raised By</span>
                <span className="text-[#1F1F1F]">{selectedRequest.raiser.name}</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-[#6C757D] uppercase">Technician</span>
                <span className="text-[#1F1F1F]">{selectedRequest.technician || 'Not assigned'}</span>
              </div>
              {selectedRequest.resolved_at && (
                <div>
                  <span className="block text-[10px] font-semibold text-[#6C757D] uppercase">Resolved Date</span>
                  <span className="text-[#1F1F1F]">
                    {new Date(selectedRequest.resolved_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-[#E3E3E6] pt-3 mt-2">
              <span className="block text-[10px] font-semibold text-[#6C757D] uppercase mb-1">Issue Details</span>
              <p className="text-xs text-[#1F1F1F] bg-gray-50 p-2.5 rounded-sm leading-normal">{selectedRequest.issue}</p>
            </div>

            {selectedRequest.resolution_notes && (
              <div className="border-t border-[#E3E3E6] pt-3 mt-2">
                <span className="block text-[10px] font-semibold text-[#6C757D] uppercase mb-1">Resolution Summary</span>
                <p className="text-xs text-[#1F1F1F] bg-green-50/50 p-2.5 border border-green-100 rounded-sm leading-normal">
                  {selectedRequest.resolution_notes}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Assign Tech Modal */}
      <Modal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign Maintenance Technician"
        footer={
          <>
            <button
              onClick={() => setAssignOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedRequest && techName) {
                  assignTechMutation.mutate({ id: selectedRequest.id, technician: techName });
                }
              }}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Assign Technician
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Technician Name (or service vendor) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={techName}
              onChange={(e) => setTechName(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
              placeholder="e.g. Alice Johnson (Hardware Tech)"
            />
          </div>
        </div>
      </Modal>

      {/* Resolve Request Modal */}
      <Modal
        isOpen={resolveOpen}
        onClose={() => setResolveOpen(false)}
        title="Mark Request as Resolved"
        footer={
          <>
            <button
              onClick={() => setResolveOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedRequest && resolveNotes) {
                  resolveMutation.mutate({ id: selectedRequest.id, notes: resolveNotes });
                }
              }}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Confirm Resolution
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Resolution Check-in Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67] h-20 resize-none"
              placeholder="Please summarize the repairs executed."
            />
          </div>
        </div>
      </Modal>

      {/* Reject Request Modal */}
      <Modal
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject Maintenance Request"
        footer={
          <>
            <button
              onClick={() => setRejectOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedRequest && rejectReason) {
                  rejectMutation.mutate({ id: selectedRequest.id, reason: rejectReason });
                }
              }}
              className="rounded-sm bg-[#DC3545] px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
            >
              Reject Request
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Rejection Rationale <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67] h-20 resize-none"
              placeholder="Provide a rationale for rejection."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
