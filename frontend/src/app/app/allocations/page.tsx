'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import Modal from '../../../components/Modal';
import { Plus, ArrowLeftRight, Check, X, Undo2 } from 'lucide-react';

interface Allocation {
  id: string;
  asset_id: string;
  employee_id: string | null;
  department_id: string | null;
  allocated_by: string;
  allocated_at: string;
  expected_return_date: string | null;
  returned_at: string | null;
  condition_in: string | null;
  condition_out: string | null;
  checkin_notes: string | null;
  asset: { tag: string; name: string };
  employee?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
}

interface TransferRequest {
  id: string;
  asset_id: string;
  from_allocation_id: string;
  requested_by: string;
  to_employee_id: string | null;
  to_department_id: string | null;
  status: string;
  reason: string | null;
  decided_at: string | null;
  from_allocation: {
    asset: { tag: string; name: string };
    employee?: { name: string } | null;
    department?: { name: string } | null;
  };
  requester: { name: string };
}

interface Asset {
  id: string;
  tag: string;
  name: string;
  status: string;
}

interface Employee {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

export default function AllocationsPage() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog / Modal state
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assigneeType, setAssigneeType] = useState<'Employee' | 'Department'>('Employee');
  const [assigneeId, setAssigneeId] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');

  // Conflict Modal State
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictHolderName, setConflictHolderName] = useState('');
  const [conflictAssetTag, setConflictAssetTag] = useState('');
  const [conflictAssetName, setConflictAssetName] = useState('');

  // Transfer Request Modal
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferReason, setTransferReason] = useState('');
  const [transferAssetId, setTransferAssetId] = useState('');

  // Return Modal State
  const [returnOpen, setReturnOpen] = useState(false);
  const [returningAlloc, setReturningAlloc] = useState<Allocation | null>(null);
  const [returnCondition, setReturnCondition] = useState('Good');
  const [returnNotes, setReturnNotes] = useState('');

  // Reject Transfer state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectingTransferId, setRejectingTransferId] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // Fetch lists
  const { data: allocations = [] } = useQuery<Allocation[]>({
    queryKey: ['allocations'],
    queryFn: () => apiFetch('/allocations'),
  });

  const { data: transfers = [] } = useQuery<TransferRequest[]>({
    queryKey: ['transfers'],
    queryFn: () => apiFetch('/transfer-requests'),
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: () => apiFetch('/assets'),
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => apiFetch('/employees'),
    enabled: role === 'Admin' || role === 'Asset Manager' || role === 'Department Head',
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => apiFetch('/departments'),
  });

  const availableAssets = assets.filter((a) => a.status === 'Available');

  // Mutation Allocate
  const allocateMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/allocations', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setAllocateOpen(false);
      toast('Asset allocated successfully!');
    },
    onError: (err: any) => {
      if (err instanceof ApiError && err.code === 'already_allocated') {
        const holder = err.meta?.current_holder;
        const holderName = holder?.employee?.name || holder?.department?.name || 'Unknown';
        const assetObj = assets.find((a) => a.id === selectedAssetId);
        setConflictHolderName(holderName);
        setConflictAssetTag(assetObj?.tag || '');
        setConflictAssetName(assetObj?.name || '');
        setConflictOpen(true);
      } else {
        toast(err.message, 'error');
      }
    },
  });

  // Mutation Return
  const returnMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiFetch(`/allocations/${id}/return`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setReturnOpen(false);
      toast('Asset returned successfully!');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  // Mutation Create Transfer Request
  const transferMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/transfer-requests', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      setTransferOpen(false);
      setConflictOpen(false);
      setAllocateOpen(false);
      toast('Transfer request initiated successfully!');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  // Mutation Approve Transfer
  const approveTransferMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/transfer-requests/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast('Transfer approved and asset re-allocated!');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  // Mutation Reject Transfer
  const rejectTransferMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/transfer-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      setRejectOpen(false);
      toast('Transfer request rejected.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const handleAllocate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !assigneeId) return;

    allocateMutation.mutate({
      asset_id: selectedAssetId,
      employee_id: assigneeType === 'Employee' ? assigneeId : undefined,
      department_id: assigneeType === 'Department' ? assigneeId : undefined,
      expected_return_date: expectedReturnDate || undefined,
    });
  };

  const handleOpenReturnModal = (alloc: Allocation) => {
    setReturningAlloc(alloc);
    setReturnNotes('');
    setReturnCondition('Good');
    setReturnOpen(true);
  };

  const handleReturnAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningAlloc) return;
    if (!returnNotes) {
      toast('Add a condition note before confirming the return.', 'error');
      return;
    }

    returnMutation.mutate({
      id: returningAlloc.id,
      data: { condition_in: returnCondition, checkin_notes: returnNotes },
    });
  };

  const handleOpenTransferModal = () => {
    setTransferReason('');
    setTransferAssetId(selectedAssetId);
    setTransferOpen(true);
  };

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigneeId) return;

    transferMutation.mutate({
      asset_id: transferAssetId,
      to_employee_id: assigneeType === 'Employee' ? assigneeId : undefined,
      to_department_id: assigneeType === 'Department' ? assigneeId : undefined,
      reason: transferReason,
    });
  };

  const handleOpenRejectModal = (id: string) => {
    setRejectingTransferId(id);
    setRejectReason('');
    setRejectOpen(true);
  };

  const handleRejectTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason) {
      toast('Add a reason for rejecting this request.', 'error');
      return;
    }
    rejectTransferMutation.mutate({ id: rejectingTransferId, reason: rejectReason });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1F1F1F]">Allocations & Transfers</h1>
          <p className="text-xs text-[#6C757D] mt-0.5">Manage assignments, returns, and inter-department asset transfers.</p>
        </div>
        {role !== 'Employee' && (
          <button
            onClick={() => setAllocateOpen(true)}
            className="flex items-center gap-1.5 rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53] transition-colors self-start sm:self-auto"
          >
            <Plus size={14} />
            Allocate Asset
          </button>
        )}
      </div>

      {/* Grid of lists */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Active Allocations List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#1F1F1F] uppercase tracking-wider">Active Allocations</h2>
          </div>
          <DataTable
            columns={[
              { header: 'Asset Tag', accessor: (row) => <span className="font-semibold">{row.asset.tag}</span> },
              { header: 'Asset Name', accessor: (row) => row.asset.name },
              { header: 'Holder', accessor: (row) => row.employee?.name || row.department?.name || 'Unassigned' },
              {
                header: 'Expected Return',
                accessor: (row) => (row.expected_return_date ? new Date(row.expected_return_date).toLocaleDateString() : 'None'),
              },
              {
                header: 'Actions',
                accessor: (row) => {
                  const isOverdue = row.expected_return_date && new Date(row.expected_return_date) < new Date() && !row.returned_at;
                  return (
                    <div className="flex gap-2">
                      {!row.returned_at && (role === 'Admin' || role === 'Asset Manager') && (
                        <button
                          onClick={() => handleOpenReturnModal(row)}
                          className="text-[10px] text-[#714B67] border border-[#714B67]/30 px-1.5 py-0.5 rounded-sm hover:bg-[#714B67]/5 flex items-center gap-1 font-medium"
                        >
                          <Undo2 size={10} /> Return
                        </button>
                      )}
                      {!row.returned_at && (row.employee_id === user?.id || role === 'Admin' || role === 'Asset Manager') && (
                        <button
                          onClick={() => {
                            setSelectedAssetId(row.asset_id);
                            handleOpenTransferModal();
                          }}
                          className="text-[10px] text-[#714B67] border border-[#714B67]/30 px-1.5 py-0.5 rounded-sm hover:bg-[#714B67]/5 flex items-center gap-1 font-medium"
                        >
                          <ArrowLeftRight size={10} /> Transfer
                        </button>
                      )}
                      {isOverdue && (
                        <span className="text-[9px] bg-red-100 text-red-600 font-bold px-1 py-0.5 rounded-sm uppercase tracking-wide">
                          Overdue
                        </span>
                      )}
                    </div>
                  );
                },
              },
            ]}
            data={allocations.filter((a) => !a.returned_at)}
            emptyMessage="No active allocations found."
          />
        </div>

        {/* Transfer Requests List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#1F1F1F] uppercase tracking-wider">Transfer Requests</h2>
          </div>
          <DataTable
            columns={[
              { header: 'Asset', accessor: (row) => row.from_allocation.asset.name },
              { header: 'From Holder', accessor: (row) => row.from_allocation.employee?.name || row.from_allocation.department?.name || 'Unassigned' },
              { header: 'Requested By', accessor: (row) => row.requester.name },
              { header: 'Reason', accessor: (row) => row.reason || 'None' },
              { header: 'Status', accessor: (row) => <StatusBadge status={row.status} /> },
              {
                header: 'Actions',
                accessor: (row) => {
                  const canAct = role === 'Admin' || role === 'Asset Manager' || role === 'Department Head';
                  if (row.status === 'Requested' && canAct) {
                    return (
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveTransferMutation.mutate(row.id)}
                          className="text-[10px] text-green-600 border border-green-200 px-1.5 py-0.5 rounded-sm hover:bg-green-50 flex items-center gap-1 font-medium"
                        >
                          <Check size={10} /> Approve
                        </button>
                        <button
                          onClick={() => handleOpenRejectModal(row.id)}
                          className="text-[10px] text-red-600 border border-red-200 px-1.5 py-0.5 rounded-sm hover:bg-red-50 flex items-center gap-1 font-medium"
                        >
                          <X size={10} /> Reject
                        </button>
                      </div>
                    );
                  }
                  return null;
                },
              },
            ]}
            data={transfers}
            emptyMessage="No pending transfer requests."
          />
        </div>
      </div>

      {/* Allocate Asset Modal */}
      <Modal
        isOpen={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        title="Allocate Asset"
        footer={
          <>
            <button
              onClick={() => setAllocateOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAllocate}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Confirm Allocation
            </button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Select Available Asset
            </label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none bg-white"
            >
              <option value="">Choose an asset...</option>
              {availableAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} ({asset.tag})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Allocate To
            </label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-1.5 text-xs text-[#1F1F1F] select-none">
                <input
                  type="radio"
                  checked={assigneeType === 'Employee'}
                  onChange={() => {
                    setAssigneeType('Employee');
                    setAssigneeId('');
                  }}
                  className="text-[#714B67] focus:ring-[#714B67]"
                />
                Employee
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[#1F1F1F] select-none">
                <input
                  type="radio"
                  checked={assigneeType === 'Department'}
                  onChange={() => {
                    setAssigneeType('Department');
                    setAssigneeId('');
                  }}
                  className="text-[#714B67] focus:ring-[#714B67]"
                />
                Department
              </label>
            </div>

            {assigneeType === 'Employee' ? (
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none bg-white"
              >
                <option value="">Select Employee...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none bg-white"
              >
                <option value="">Select Department...</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Expected Return Date
            </label>
            <input
              type="date"
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
            />
          </div>
        </form>
      </Modal>

      {/* Conflict Modal */}
      <Modal
        isOpen={conflictOpen}
        onClose={() => setConflictOpen(false)}
        title="Asset Already Allocated"
        footer={
          <>
            <button
              onClick={() => setConflictOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setConflictOpen(false);
                handleOpenTransferModal();
              }}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Request Transfer
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-sm border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <strong>Direct re-allocation is blocked.</strong> {conflictAssetTag} – {conflictAssetName} is currently held by{' '}
            <strong>{conflictHolderName}</strong>.
          </div>
          <p className="text-xs text-[#6C757D]">
            Would you like to initiate a transfer request to request ownership release of this asset?
          </p>
        </div>
      </Modal>

      {/* Transfer Request Modal */}
      <Modal
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Request Asset Transfer"
        footer={
          <>
            <button
              onClick={() => setTransferOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTransfer}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Send Request
            </button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Reason / Rationale
            </label>
            <textarea
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67] h-20 resize-none"
              placeholder="e.g. Relocating office and require this workstation setup."
            />
          </div>
        </form>
      </Modal>

      {/* Return Asset Modal */}
      <Modal
        isOpen={returnOpen}
        onClose={() => setReturnOpen(false)}
        title="Check-in Return Asset"
        footer={
          <>
            <button
              onClick={() => setReturnOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReturnAsset}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Confirm Return
            </button>
          </>
        }
      >
        <form className="space-y-4">
          {returningAlloc && (
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#6C757D] mb-1">Asset</span>
              <span className="text-xs font-semibold text-[#1F1F1F]">
                {returningAlloc.asset.name} ({returningAlloc.asset.tag})
              </span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Condition on Return
            </label>
            <select
              value={returnCondition}
              onChange={(e) => setReturnCondition(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none bg-white"
            >
              <option value="New">New</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Check-in notes / Condition Notes
            </label>
            <textarea
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67] h-20 resize-none"
              placeholder="e.g. Laptop checked back in, good condition, minor scratch."
            />
          </div>
        </form>
      </Modal>

      {/* Reject Reason Modal */}
      <Modal
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject Transfer Request"
        footer={
          <>
            <button
              onClick={() => setRejectOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectTransfer}
              className="rounded-sm bg-[#DC3545] px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
            >
              Reject Request
            </button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Rejection Reason
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67] h-20 resize-none"
              placeholder="Please justify why this transfer request is rejected."
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
