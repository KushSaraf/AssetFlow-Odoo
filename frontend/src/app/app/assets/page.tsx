'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import Modal from '../../../components/Modal';
import { Plus, Search, Filter, FileText, Calendar, Wrench, ShieldAlert } from 'lucide-react';

interface Asset {
  id: string;
  tag: string;
  name: string;
  category_id: string;
  department_id: string | null;
  serial_number: string | null;
  acquisition_date: string;
  acquisition_cost: number | null;
  condition: string;
  location: string | null;
  status: string;
  is_bookable: boolean;
  category: { name: string };
  department?: { name: string } | null;
  custom_fields?: any[];
}

interface Category {
  id: string;
  name: string;
  fields: { id: string; field_name: string; field_type: string; required: boolean }[];
}

interface Department {
  id: string;
  name: string;
}

export default function AssetDirectoryPage() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Asset dialogs state
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'allocation' | 'maintenance' | 'documents'>('info');

  const [registerOpen, setRegisterOpen] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [assetCatId, setAssetCatId] = useState('');
  const [assetSerial, setAssetSerial] = useState('');
  const [assetAcqDate, setAssetAcqDate] = useState('');
  const [assetAcqCost, setAssetAcqCost] = useState('');
  const [assetCondition, setAssetCondition] = useState('Good');
  const [assetLocation, setAssetLocation] = useState('');
  const [assetIsBookable, setAssetIsBookable] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-open registration from URL quick actions
  useEffect(() => {
    if (searchParams.get('action') === 'register') {
      if (role === 'Admin' || role === 'Asset Manager') {
        setRegisterOpen(true);
      }
    }
  }, [searchParams, role]);

  // Fetch Category lists & Departments for select dropdowns
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => apiFetch('/categories'),
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => apiFetch('/departments'),
  });

  // Fetch Assets
  const queryParams = new URLSearchParams();
  if (search) queryParams.set('q', search);
  if (catFilter) queryParams.set('category_id', catFilter);
  if (statusFilter) queryParams.set('status', statusFilter);
  if (deptFilter) queryParams.set('department_id', deptFilter);

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ['assets', search, catFilter, statusFilter, deptFilter],
    queryFn: () => apiFetch(`/assets?${queryParams.toString()}`),
    enabled: !!user,
  });

  // Fetch Details History tabs dynamically
  const { data: allocationHistory = [] } = useQuery({
    queryKey: ['assets', selectedAsset?.id, 'allocations'],
    queryFn: () => apiFetch(`/assets/${selectedAsset?.id}/allocation-history`),
    enabled: !!selectedAsset && activeDetailTab === 'allocation',
  });

  const { data: maintenanceHistory = [] } = useQuery({
    queryKey: ['assets', selectedAsset?.id, 'maintenance'],
    queryFn: () => apiFetch(`/assets/${selectedAsset?.id}/maintenance-history`),
    enabled: !!selectedAsset && activeDetailTab === 'maintenance',
  });

  // Mutation Asset Create / Edit
  const createAssetMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/assets', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setRegisterOpen(false);
      toast('Asset registered successfully!');
      router.replace('/app/assets'); // Clear URL query params
    },
    onError: (err: any) => {
      if (err instanceof ApiError && err.code === 'validation_error' && err.field) {
        setErrors({ [err.field]: err.message });
      } else {
        toast(err.message, 'error');
      }
    },
  });

  const updateAssetStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/assets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      if (selectedAsset) setSelectedAsset(data);
      toast('Asset status updated.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  // Form Validation and submission
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!assetName) newErrors.name = 'Asset name is required.';
    if (!assetCatId) newErrors.category_id = 'Category is required.';
    if (!assetAcqDate) newErrors.acquisition_date = 'Acquisition date is required.';
    else if (new Date(assetAcqDate) > new Date()) {
      newErrors.acquisition_date = "Acquisition date can't be in the future.";
    }

    // Custom fields validation
    const category = categories.find((c) => c.id === assetCatId);
    if (category) {
      category.fields.forEach((field) => {
        if (field.required && !customFieldValues[field.id]) {
          newErrors[`custom_${field.id}`] = `${field.field_name} is required.`;
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegisterAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      name: assetName,
      category_id: assetCatId,
      serial_number: assetSerial || null,
      acquisition_date: new Date(assetAcqDate).toISOString(),
      acquisition_cost: assetAcqCost ? parseFloat(assetAcqCost) : null,
      condition: assetCondition,
      location: assetLocation || null,
      is_bookable: assetIsBookable,
      custom_fields: customFieldValues,
    };

    createAssetMutation.mutate(payload);
  };

  const handleCategoryChange = (catId: string) => {
    setAssetCatId(catId);
    setCustomFieldValues({}); // reset custom fields
  };

  const handleOpenDetail = (asset: Asset) => {
    setSelectedAsset(asset);
    setActiveDetailTab('info');
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1F1F1F]">Asset Directory</h1>
          <p className="text-xs text-[#6C757D] mt-0.5">Search, allocate, and monitor physical assets across all locations.</p>
        </div>
        {(role === 'Admin' || role === 'Asset Manager') && (
          <button
            onClick={() => {
              setErrors({});
              setRegisterOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53] transition-colors self-start sm:self-auto"
          >
            <Plus size={14} />
            Register Asset
          </button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col gap-3 rounded-sm border border-[#E3E3E6] bg-white p-3 md:flex-row md:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-[#6C757D]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-sm border border-[#E3E3E6] pl-9 pr-3 py-1.5 text-xs outline-none focus:border-[#714B67]"
            placeholder="Search by tag, serial, or name..."
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Category */}
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-sm border border-[#E3E3E6] px-2 py-1.5 text-xs outline-none bg-white max-w-[150px]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Department */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-sm border border-[#E3E3E6] px-2 py-1.5 text-xs outline-none bg-white max-w-[150px]"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-sm border border-[#E3E3E6] px-2 py-1.5 text-xs outline-none bg-white max-w-[150px]"
          >
            <option value="">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Allocated">Allocated</option>
            <option value="Reserved">Reserved</option>
            <option value="Under Maintenance">Under Maintenance</option>
            <option value="Lost">Lost</option>
            <option value="Retired">Retired</option>
            <option value="Disposed">Disposed</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <DataTable
        columns={[
          { header: 'Asset Tag', accessor: (row) => <span className="font-semibold">{row.tag}</span> },
          { header: 'Asset Name', accessor: (row) => row.name },
          { header: 'Category', accessor: (row) => row.category?.name || 'Unknown' },
          { header: 'Location', accessor: (row) => row.location || '—' },
          { header: 'Department', accessor: (row) => row.department?.name || 'Shared' },
          { header: 'Condition', accessor: (row) => row.condition },
          { header: 'Status', accessor: (row) => <StatusBadge status={row.status} /> },
        ]}
        data={assets}
        onRowClick={handleOpenDetail}
        emptyMessage={isLoading ? 'Loading assets...' : 'No assets matching search criteria.'}
      />

      {/* Registration Modal */}
      <Modal
        isOpen={registerOpen}
        onClose={() => {
          setRegisterOpen(false);
          router.replace('/app/assets');
        }}
        title="Register New Asset"
        footer={
          <>
            <button
              onClick={() => {
                setRegisterOpen(false);
                router.replace('/app/assets');
              }}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRegisterAsset}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Register Asset
            </button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Asset Name
            </label>
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              className={`w-full rounded-sm border px-3 py-2 text-xs outline-none focus:border-[#714B67] ${
                errors.name ? 'border-red-500' : 'border-[#E3E3E6]'
              }`}
              placeholder="e.g. Dell Latitude 5420"
            />
            {errors.name && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.name}</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                Asset Category
              </label>
              <select
                value={assetCatId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className={`w-full rounded-sm border px-3 py-2 text-xs outline-none bg-white ${
                  errors.category_id ? 'border-red-500' : 'border-[#E3E3E6]'
                }`}
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.category_id && (
                <span className="text-[10px] text-red-500 mt-0.5 block">{errors.category_id}</span>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                Serial Number
              </label>
              <input
                type="text"
                value={assetSerial}
                onChange={(e) => setAssetSerial(e.target.value)}
                className={`w-full rounded-sm border px-3 py-2 text-xs outline-none focus:border-[#714B67] ${
                  errors.serial_number ? 'border-red-500' : 'border-[#E3E3E6]'
                }`}
                placeholder="SN-1029302"
              />
              {errors.serial_number && (
                <span className="text-[10px] text-red-500 mt-0.5 block">{errors.serial_number}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                Acquisition Date
              </label>
              <input
                type="date"
                value={assetAcqDate}
                onChange={(e) => setAssetAcqDate(e.target.value)}
                className={`w-full rounded-sm border px-3 py-2 text-xs outline-none focus:border-[#714B67] ${
                  errors.acquisition_date ? 'border-red-500' : 'border-[#E3E3E6]'
                }`}
              />
              {errors.acquisition_date && (
                <span className="text-[10px] text-red-500 mt-0.5 block">{errors.acquisition_date}</span>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                Acquisition Cost ($)
              </label>
              <input
                type="number"
                value={assetAcqCost}
                onChange={(e) => setAssetAcqCost(e.target.value)}
                className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
                placeholder="1200.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                Initial Condition
              </label>
              <select
                value={assetCondition}
                onChange={(e) => setAssetCondition(e.target.value)}
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
                Initial Location
              </label>
              <input
                type="text"
                value={assetLocation}
                onChange={(e) => setAssetLocation(e.target.value)}
                className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
                placeholder="e.g. Office Room 3B"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="bookableCheck"
              checked={assetIsBookable}
              onChange={(e) => setAssetIsBookable(e.target.checked)}
              className="h-4 w-4 rounded-sm border-[#E3E3E6] text-[#714B67] focus:ring-[#714B67]"
            />
            <label htmlFor="bookableCheck" className="text-xs font-medium text-[#1F1F1F] select-none">
              Mark as Bookable / Shared Resource
            </label>
          </div>

          {/* Render category dynamic custom fields */}
          {assetCatId && categories.find((c) => c.id === assetCatId)?.fields.length! > 0 && (
            <div className="border-t border-[#E3E3E6] pt-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#6C757D] mb-3">
                Category Attributes
              </span>
              <div className="space-y-3">
                {categories
                  .find((c) => c.id === assetCatId)
                  ?.fields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                        {field.field_name} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                        value={customFieldValues[field.id] || ''}
                        onChange={(e) =>
                          setCustomFieldValues({ ...customFieldValues, [field.id]: e.target.value })
                        }
                        className={`w-full rounded-sm border px-3 py-2 text-xs outline-none focus:border-[#714B67] ${
                          errors[`custom_${field.id}`] ? 'border-red-500' : 'border-[#E3E3E6]'
                        }`}
                      />
                      {errors[`custom_${field.id}`] && (
                        <span className="text-[10px] text-red-500 mt-0.5 block">{errors[`custom_${field.id}`]}</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Details View Modal */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selectedAsset ? `Asset Details — ${selectedAsset.tag}` : 'Asset Details'}
        footer={
          selectedAsset && (role === 'Admin' || role === 'Asset Manager') ? (
            <div className="flex gap-2 w-full justify-between items-center">
              <div className="flex gap-2">
                {selectedAsset.status === 'Available' && (
                  <>
                    <button
                      onClick={() => updateAssetStatusMutation.mutate({ id: selectedAsset.id, status: 'Retired' })}
                      className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
                    >
                      Retire Asset
                    </button>
                    <button
                      onClick={() => updateAssetStatusMutation.mutate({ id: selectedAsset.id, status: 'Disposed' })}
                      className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
                    >
                      Dispose Asset
                    </button>
                  </>
                )}
                {(selectedAsset.status === 'Retired' || selectedAsset.status === 'Disposed') && (
                  <button
                    onClick={() => updateAssetStatusMutation.mutate({ id: selectedAsset.id, status: 'Available' })}
                    className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
                  >
                    Set Available
                  </button>
                )}
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
              >
                Close Details
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDetailOpen(false)}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Close
            </button>
          )
        }
      >
        {selectedAsset && (
          <div className="space-y-4">
            {/* Details tabs */}
            <div className="flex border-b border-[#E3E3E6]">
              <button
                onClick={() => setActiveDetailTab('info')}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-all ${
                  activeDetailTab === 'info'
                    ? 'border-[#714B67] text-[#714B67]'
                    : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
                }`}
              >
                General Info
              </button>
              <button
                onClick={() => setActiveDetailTab('allocation')}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-all ${
                  activeDetailTab === 'allocation'
                    ? 'border-[#714B67] text-[#714B67]'
                    : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
                }`}
              >
                Allocations
              </button>
              <button
                onClick={() => setActiveDetailTab('maintenance')}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-all ${
                  activeDetailTab === 'maintenance'
                    ? 'border-[#714B67] text-[#714B67]'
                    : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
                }`}
              >
                Maintenance Logs
              </button>
            </div>

            {/* Tab Contents */}
            {activeDetailTab === 'info' && (
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-2 col-span-2 border-b border-[#E3E3E6] pb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-[#1F1F1F]">{selectedAsset.name}</span>
                    <StatusBadge status={selectedAsset.status} />
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-semibold text-[#6C757D] uppercase">Category</span>
                  <span className="text-[#1F1F1F]">{selectedAsset.category?.name}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-[#6C757D] uppercase">Serial Number</span>
                  <span className="text-[#1F1F1F]">{selectedAsset.serial_number || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-[#6C757D] uppercase">Location</span>
                  <span className="text-[#1F1F1F]">{selectedAsset.location || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-[#6C757D] uppercase">Acquisition Cost</span>
                  <span className="text-[#1F1F1F]">
                    {selectedAsset.acquisition_cost ? `$${selectedAsset.acquisition_cost}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-[#6C757D] uppercase">Acquisition Date</span>
                  <span className="text-[#1F1F1F]">
                    {new Date(selectedAsset.acquisition_date).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-[#6C757D] uppercase">Shared / Bookable</span>
                  <span className="text-[#1F1F1F]">{selectedAsset.is_bookable ? 'Yes' : 'No'}</span>
                </div>

                {/* Render Custom Fields Values */}
                {selectedAsset.custom_fields && selectedAsset.custom_fields.length > 0 && (
                  <div className="col-span-2 border-t border-[#E3E3E6] pt-3 mt-2 grid grid-cols-2 gap-4">
                    {selectedAsset.custom_fields.map((cf) => (
                      <div key={cf.id}>
                        <span className="block text-[10px] font-semibold text-[#6C757D] uppercase">
                          {cf.category_field?.field_name}
                        </span>
                        <span className="text-[#1F1F1F]">{cf.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeDetailTab === 'allocation' && (
              <div className="space-y-2">
                <DataTable
                  columns={[
                    {
                      header: 'Allocated To',
                      accessor: (row: any) => row.employee?.name || row.department?.name || 'Shared',
                    },
                    {
                      header: 'Date From',
                      accessor: (row: any) => new Date(row.allocated_at).toLocaleDateString(),
                    },
                    {
                      header: 'Expected Return',
                      accessor: (row: any) =>
                        row.expected_return_date ? new Date(row.expected_return_date).toLocaleDateString() : '—',
                    },
                    {
                      header: 'Returned On',
                      accessor: (row: any) => (row.returned_at ? new Date(row.returned_at).toLocaleDateString() : 'Active'),
                    },
                  ]}
                  data={allocationHistory}
                  emptyMessage="No allocation history found."
                />
              </div>
            )}

            {activeDetailTab === 'maintenance' && (
              <div className="space-y-2">
                <DataTable
                  columns={[
                    { header: 'Issue Description', accessor: (row: any) => row.issue },
                    { header: 'Priority', accessor: (row: any) => row.priority },
                    { header: 'Status', accessor: (row: any) => <StatusBadge status={row.status} /> },
                    {
                      header: 'Date Resolved',
                      accessor: (row: any) => (row.resolved_at ? new Date(row.resolved_at).toLocaleDateString() : '—'),
                    },
                  ]}
                  data={maintenanceHistory}
                  emptyMessage="No maintenance logs found."
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
