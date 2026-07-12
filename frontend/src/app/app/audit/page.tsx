'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import Modal from '../../../components/Modal';
import { Plus, ShieldAlert, Check, X, ClipboardCheck, FileWarning, Lock } from 'lucide-react';

interface AuditCycle {
  id: string;
  name: string;
  scope_department_id: string | null;
  scope_location: string | null;
  start_date: string;
  end_date: string;
  status: string;
  closed_at: string | null;
  department?: { name: string } | null;
  assignments: { auditor: { name: string } }[];
  findings?: any[];
}

interface Employee {
  id: string;
  name: string;
  role: string;
}

interface Department {
  id: string;
  name: string;
}

interface Finding {
  id: string;
  asset_id: string;
  result: string;
  notes: string | null;
  recorded_by: string;
  asset: { tag: string; name: string; location: string | null };
  recorder: { name: string };
}

export default function AuditPage() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'checklist' | 'discrepancy'>('checklist');

  // Modals state
  const [createOpen, setCreateOpen] = useState(false);
  const [cycleName, setCycleName] = useState('');
  const [scopeDeptId, setScopeDeptId] = useState('');
  const [scopeLoc, setScopeLoc] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [findingOpen, setFindingOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedAssetName, setSelectedAssetName] = useState('');
  const [findingResult, setFindingResult] = useState('Verified');
  const [findingNotes, setFindingNotes] = useState('');

  const [closeOpen, setCloseOpen] = useState(false);

  // Fetch lists
  const { data: cycles = [] } = useQuery<AuditCycle[]>({
    queryKey: ['audit-cycles'],
    queryFn: () => apiFetch('/audit-cycles'),
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => apiFetch('/employees'),
    enabled: role === 'Admin',
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => apiFetch('/departments'),
  });

  // Fetch Active Cycle Detail (checklist + findings)
  const { data: activeCycle, isLoading: detailLoading } = useQuery<any>({
    queryKey: ['audit-cycles', activeCycleId],
    queryFn: () => apiFetch(`/audit-cycles/${activeCycleId}`),
    enabled: !!activeCycleId,
  });

  // Fetch Discrepancy report
  const { data: discrepancies = [] } = useQuery<Finding[]>({
    queryKey: ['audit-cycles', activeCycleId, 'discrepancy-report'],
    queryFn: () => apiFetch(`/audit-cycles/${activeCycleId}/discrepancy-report`),
    enabled: !!activeCycleId && activeTab === 'discrepancy',
  });

  // Mutation Create
  const createMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/audit-cycles', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-cycles'] });
      setCreateOpen(false);
      toast('Audit cycle created successfully!');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  // Mutation Record Finding
  const findingMutation = useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/audit-cycles/${activeCycleId}/findings`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-cycles', activeCycleId] });
      setFindingOpen(false);
      toast('Finding recorded successfully!');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  // Mutation Close Cycle
  const closeMutation = useMutation({
    mutationFn: () => apiFetch(`/audit-cycles/${activeCycleId}/close`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['audit-cycles', activeCycleId] });
      setCloseOpen(false);
      toast('Audit Cycle closed successfully! Discrepancy actions triggered.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const handleCreateCycle = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!cycleName) newErrors.name = 'Cycle name is required.';
    if (!startDate) newErrors.start = 'Start date is required.';
    if (!endDate) newErrors.end = 'End date is required.';
    if (selectedAuditors.length === 0) newErrors.auditors = 'Assign at least one auditor.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createMutation.mutate({
      name: cycleName,
      scope_department_id: scopeDeptId || undefined,
      scope_location: scopeLoc || undefined,
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      auditor_ids: selectedAuditors,
    });
  };

  const handleRecordFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if ((findingResult === 'Missing' || findingResult === 'Damaged') && !findingNotes) {
      toast('Add a note explaining the discrepancy.', 'error');
      return;
    }
    findingMutation.mutate({
      asset_id: selectedAssetId,
      result: findingResult,
      notes: findingNotes || undefined,
    });
  };

  const toggleAuditorSelection = (id: string) => {
    setSelectedAuditors((prev) => (prev.includes(id) ? prev.filter((aId) => aId !== id) : [...prev, id]));
  };

  const handleSelectCycle = (cycle: AuditCycle) => {
    setActiveCycleId(cycle.id);
    setActiveTab('checklist');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1F1F1F]">Asset Audit Cycles</h1>
          <p className="text-xs text-[#6C757D] mt-0.5">Define cycle checklists, assign auditors, and resolve inventory discrepancies.</p>
        </div>
        {role === 'Admin' && (
          <button
            onClick={() => {
              setErrors({});
              setSelectedAuditors([]);
              setCycleName('');
              setScopeDeptId('');
              setScopeLoc('');
              setStartDate('');
              setEndDate('');
              setCreateOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53] transition-colors self-start sm:self-auto"
          >
            <Plus size={14} />
            New Audit Cycle
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {/* Left Side: Audit list */}
        <div className="rounded-sm border border-[#E3E3E6] bg-white p-3 space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#6C757D]">Active / Past Cycles</h3>
          <div className="space-y-1">
            {cycles.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#6C757D]">No audit cycles created.</div>
            ) : (
              cycles.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCycle(c)}
                  className={`flex w-full flex-col rounded-sm p-2.5 text-left border transition-all ${
                    activeCycleId === c.id
                      ? 'border-[#714B67] bg-[#714B67]/5 text-[#714B67]'
                      : 'border-transparent text-[#6C757D] hover:bg-[#F7F7F8] hover:text-[#1F1F1F]'
                  }`}
                >
                  <span className="text-xs font-semibold">{c.name}</span>
                  <div className="flex items-center justify-between w-full mt-1.5">
                    <span className="text-[9px] text-[#6C757D]">
                      {new Date(c.start_date).toLocaleDateString()} – {new Date(c.end_date).toLocaleDateString()}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Cycle Details & Findings */}
        <div className="md:col-span-3 space-y-4">
          {activeCycleId ? (
            detailLoading ? (
              <div className="bg-white border border-[#E3E3E6] rounded-sm p-8 text-center text-xs text-[#6C757D]">
                Loading cycle details...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header Summary info */}
                <div className="bg-white border border-[#E3E3E6] rounded-sm p-4 flex flex-col justify-between sm:flex-row gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xs font-bold text-[#1F1F1F] uppercase tracking-wider">{activeCycle.name}</h2>
                    <p className="text-[11px] text-[#6C757D]">
                      Scope: {activeCycle.department?.name || 'All Departments'}{' '}
                      {activeCycle.scope_location ? `• Loc: ${activeCycle.scope_location}` : ''}
                    </p>
                    <p className="text-[11px] text-[#6C757D]">
                      Auditors: {activeCycle.assignments?.map((a: any) => a.auditor.name).join(', ') || 'None'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge status={activeCycle.status} />
                    {role === 'Admin' && activeCycle.status !== 'Closed' && (
                      <button
                        onClick={() => setCloseOpen(true)}
                        className="flex items-center gap-1.5 rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53] transition-colors"
                      >
                        <Lock size={12} /> Close Cycle
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#E3E3E6]">
                  <button
                    onClick={() => setActiveTab('checklist')}
                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                      activeTab === 'checklist'
                        ? 'border-[#714B67] text-[#714B67]'
                        : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
                    }`}
                  >
                    Cycle Checklist
                  </button>
                  <button
                    onClick={() => setActiveTab('discrepancy')}
                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                      activeTab === 'discrepancy'
                        ? 'border-[#714B67] text-[#714B67]'
                        : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
                    }`}
                  >
                    Discrepancy Report
                  </button>
                </div>

                {/* Checklist Tab */}
                {activeTab === 'checklist' && (
                  <div className="space-y-4">
                    <DataTable
                      columns={[
                        { header: 'Asset Tag', accessor: (row: any) => <span className="font-semibold">{row.asset.tag}</span> },
                        { header: 'Asset Name', accessor: (row) => row.asset.name },
                        { header: 'Expected Location', accessor: (row) => row.asset.location || 'Not Specified' },
                        {
                          header: 'Result Finding',
                          accessor: (row) => {
                            const finding = activeCycle.findings?.find((f: any) => f.asset_id === row.asset.id);
                            return finding ? <StatusBadge status={finding.result} /> : '—';
                          },
                        },
                        {
                          header: 'Actions / Record',
                          accessor: (row) => {
                            const isClosed = activeCycle.status === 'Closed';
                            const isAuditor = activeCycle.assignments?.some((a: any) => a.auditor_id === user?.id) || role === 'Admin';

                            if (!isClosed && isAuditor) {
                              return (
                                <button
                                  onClick={() => {
                                    setSelectedAssetId(row.asset.id);
                                    setSelectedAssetName(row.asset.name);
                                    setFindingResult('Verified');
                                    setFindingNotes('');
                                    setFindingOpen(true);
                                  }}
                                  className="text-[10px] text-[#714B67] border border-[#714B67]/30 px-2 py-0.5 rounded-sm hover:bg-[#714B67]/5 font-semibold"
                                >
                                  Record Finding
                                </button>
                              );
                            }
                            return null;
                          },
                        },
                      ]}
                      // Checklist items are represented by assets matching the cycle scope
                      data={activeCycle.checklist || []}
                      emptyMessage="No assets match the scope of this audit cycle."
                    />
                  </div>
                )}

                {/* Discrepancy Tab */}
                {activeTab === 'discrepancy' && (
                  <div className="space-y-4">
                    <DataTable
                      columns={[
                        { header: 'Asset Tag', accessor: (row) => <span className="font-semibold">{row.asset.tag}</span> },
                        { header: 'Asset Name', accessor: (row) => row.asset.name },
                        { header: 'Discrepancy Result', accessor: (row) => <StatusBadge status={row.result} /> },
                        { header: 'Recorded By', accessor: (row) => row.recorder?.name || 'Unknown' },
                        { header: 'Finding Notes / Details', accessor: (row) => row.notes || '—' },
                      ]}
                      data={discrepancies}
                      emptyMessage="No inventory discrepancies flagged in this cycle."
                    />
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center border border-[#E3E3E6] rounded-sm bg-white py-20 text-center text-[#6C757D] text-xs">
              <ClipboardCheck size={36} className="text-gray-300 mb-2" />
              Select an audit cycle from the list to view check progress.
            </div>
          )}
        </div>
      </div>

      {/* New Cycle Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Audit Cycle"
        footer={
          <>
            <button
              onClick={() => setCreateOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCycle}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Create Cycle
            </button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Cycle Name
            </label>
            <input
              type="text"
              value={cycleName}
              onChange={(e) => setCycleName(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
              placeholder="e.g. Q3 Engineering Audit"
            />
            {errors.name && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.name}</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                Scope Department
              </label>
              <select
                value={scopeDeptId}
                onChange={(e) => setScopeDeptId(e.target.value)}
                className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none bg-white"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                Scope Location
              </label>
              <input
                type="text"
                value={scopeLoc}
                onChange={(e) => setScopeLoc(e.target.value)}
                className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
                placeholder="e.g. Building A"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
              />
              {errors.start && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.start}</span>}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
              />
              {errors.end && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.end}</span>}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Assign Auditors (At least one)
            </label>
            <div className="max-h-32 overflow-y-auto border border-[#E3E3E6] p-2 rounded-sm space-y-1">
              {employees
                .filter((emp) => emp.role === 'Asset Manager' || emp.role === 'Admin')
                .map((emp) => (
                  <label key={emp.id} className="flex items-center gap-2 text-xs text-[#1F1F1F] select-none py-0.5">
                    <input
                      type="checkbox"
                      checked={selectedAuditors.includes(emp.id)}
                      onChange={() => toggleAuditorSelection(emp.id)}
                      className="h-3.5 w-3.5 rounded-sm border-[#E3E3E6] text-[#714B67] focus:ring-[#714B67]"
                    />
                    {emp.name} ({emp.role})
                  </label>
                ))}
            </div>
            {errors.auditors && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.auditors}</span>}
          </div>
        </form>
      </Modal>

      {/* Record Finding Modal */}
      <Modal
        isOpen={findingOpen}
        onClose={() => setFindingOpen(false)}
        title={`Record Finding — ${selectedAssetName}`}
        footer={
          <>
            <button
              onClick={() => setFindingOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRecordFinding}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Confirm Finding
            </button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Finding Verification Result
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs text-[#1F1F1F] select-none">
                <input
                  type="radio"
                  checked={findingResult === 'Verified'}
                  onChange={() => setFindingResult('Verified')}
                  className="text-[#28A745] focus:ring-[#28A745]"
                />
                Verified
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[#1F1F1F] select-none">
                <input
                  type="radio"
                  checked={findingResult === 'Missing'}
                  onChange={() => setFindingResult('Missing')}
                  className="text-[#DC3545] focus:ring-[#DC3545]"
                />
                Missing
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[#1F1F1F] select-none">
                <input
                  type="radio"
                  checked={findingResult === 'Damaged'}
                  onChange={() => setFindingResult('Damaged')}
                  className="text-[#FD7E14] focus:ring-[#FD7E14]"
                />
                Damaged
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Finding Notes (Required for Missing/Damaged)
            </label>
            <textarea
              value={findingNotes}
              onChange={(e) => setFindingNotes(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67] h-20 resize-none"
              placeholder="e.g. Asset not present at assigned desk / Screen cracked."
            />
          </div>
        </form>
      </Modal>

      {/* Close Cycle Confirmation Modal */}
      <Modal
        isOpen={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Close Audit Cycle"
        footer={
          <>
            <button
              onClick={() => setCloseOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => closeMutation.mutate()}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Lock and Close Cycle
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs leading-relaxed">
          <div className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-[#B45309] font-medium flex gap-2">
            <Lock size={16} className="shrink-0 mt-0.5" />
            Closing locks this cycle — no further findings can be edited.
          </div>
          <p className="text-[#6C757D]">
            Upon closing, database side effects will trigger automatically:
            <ul className="list-disc pl-4 mt-1.5 space-y-1">
              <li>Assets marked <strong>Missing</strong> will transition their status to <strong>Lost</strong>.</li>
              <li>Assets marked <strong>Damaged</strong> will auto-create a <strong>Pending Maintenance Request</strong>.</li>
            </ul>
          </p>
        </div>
      </Modal>
    </div>
  );
}
