'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import Modal from '../../../components/Modal';
import { ShieldAlert, Plus, Edit, UserCog, UserCheck, UserMinus } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  parent_department_id: string | null;
  head_employee_id: string | null;
  status: string;
  parent_department?: { name: string } | null;
  head_employee?: { name: string } | null;
  employees?: any[];
}

interface CategoryField {
  id: string;
  field_name: string;
  field_type: string;
  required: boolean;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  status: string;
  fields: CategoryField[];
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  department_id: string | null;
  department?: { name: string } | null;
}

type TabType = 'departments' | 'categories' | 'employees';

export default function OrgSetupPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('departments');

  // Modals state
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptHeadId, setDeptHeadId] = useState('');
  const [deptParentId, setDeptParentId] = useState('');
  const [deptErrors, setDeptErrors] = useState<Record<string, string>>({});

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldRequired, setFieldRequired] = useState(false);

  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [empDeptId, setEmpDeptId] = useState('');
  const [empStatus, setEmpStatus] = useState('Active');

  // Fetch Data
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => apiFetch('/departments'),
    enabled: role === 'Admin',
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => apiFetch('/categories'),
    enabled: role === 'Admin',
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => apiFetch('/employees'),
    enabled: role === 'Admin',
  });

  // Mutate Department
  const createDeptMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/departments', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDeptModalOpen(false);
      toast('Department created successfully!');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const updateDeptMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiFetch(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDeptModalOpen(false);
      toast('Department updated successfully!');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const updateDeptStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/departments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast('Department status updated.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  // Mutate Category
  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/categories', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setCategoryModalOpen(false);
      toast('Asset category created successfully!');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const addFieldMutation = useMutation({
    mutationFn: ({ catId, data }: { catId: string; data: any }) =>
      apiFetch(`/categories/${catId}/fields`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setFieldModalOpen(false);
      toast('Custom field added successfully!');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  // Mutate Employee
  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiFetch(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setEmployeeModalOpen(false);
      toast('Employee details updated.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const promoteEmployeeMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiFetch(`/employees/${id}/promote`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast('Employee promoted successfully.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  const revokeEmployeeMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/employees/${id}/revoke`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast('Employee role revoked.');
    },
    onError: (err: any) => toast(err.message, 'error'),
  });

  if (role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldAlert size={48} className="text-red-500" />
        <h2 className="text-lg font-semibold text-[#1F1F1F]">Access Forbidden</h2>
        <p className="text-xs text-[#6C757D] max-w-sm">
          Only Administrators have permissions to access the Organization Setup master configurations.
        </p>
      </div>
    );
  }

  const handleOpenDeptModal = (dept?: Department) => {
    setDeptErrors({});
    if (dept) {
      setEditingDept(dept);
      setDeptName(dept.name);
      setDeptHeadId(dept.head_employee_id || '');
      setDeptParentId(dept.parent_department_id || '');
    } else {
      setEditingDept(null);
      setDeptName('');
      setDeptHeadId('');
      setDeptParentId('');
    }
    setDeptModalOpen(true);
  };

  const handleSaveDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName) {
      setDeptErrors({ name: 'Department name is required.' });
      return;
    }
    if (deptParentId && editingDept && deptParentId === editingDept.id) {
      setDeptErrors({ parent: "Can't set a department as its own ancestor." });
      return;
    }

    const payload = {
      name: deptName,
      head_employee_id: deptHeadId || null,
      parent_department_id: deptParentId || null,
    };

    if (editingDept) {
      updateDeptMutation.mutate({ id: editingDept.id, data: payload });
    } else {
      createDeptMutation.mutate(payload);
    }
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName) return;
    createCategoryMutation.mutate({ name: catName, description: catDesc });
    setCatName('');
    setCatDesc('');
  };

  const handleSaveField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldName || !selectedCategory) return;
    addFieldMutation.mutate({
      catId: selectedCategory.id,
      data: { field_name: fieldName, field_type: fieldType, required: fieldRequired },
    });
    setFieldName('');
    setFieldRequired(false);
  };

  const handleOpenEmployeeModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEmpDeptId(emp.department_id || '');
    setEmpStatus(emp.status);
    setEmployeeModalOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    updateEmployeeMutation.mutate({
      id: selectedEmployee.id,
      data: { department_id: empDeptId || null, status: empStatus },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1F1F1F]">Organization Setup</h1>
        <p className="text-xs text-[#6C757D] mt-0.5">Manage master department structures, asset categories, and employee roles.</p>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-[#E3E3E6]">
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'departments'
              ? 'border-[#714B67] text-[#714B67]'
              : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
          }`}
        >
          Departments
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'categories'
              ? 'border-[#714B67] text-[#714B67]'
              : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
          }`}
        >
          Asset Categories
        </button>
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'employees'
              ? 'border-[#714B67] text-[#714B67]'
              : 'border-transparent text-[#6C757D] hover:text-[#1F1F1F]'
          }`}
        >
          Employees Directory
        </button>
      </div>

      {/* Tab A: Department Management */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => handleOpenDeptModal()}
              className="flex items-center gap-1.5 rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53] transition-colors"
            >
              <Plus size={14} />
              Add Department
            </button>
          </div>

          <DataTable
            columns={[
              { header: 'Department Name', accessor: (row) => row.name },
              { header: 'Manager / Head', accessor: (row) => row.head_employee?.name || 'Unassigned' },
              { header: 'Parent Department', accessor: (row) => row.parent_department?.name || 'None' },
              { header: 'Status', accessor: (row) => <StatusBadge status={row.status} /> },
              {
                header: 'Action',
                accessor: (row) => (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDeptModal(row);
                      }}
                      className="text-[#6C757D] hover:text-[#714B67] p-1 rounded-sm hover:bg-gray-100"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateDeptStatusMutation.mutate({
                          id: row.id,
                          status: row.status === 'Active' ? 'Inactive' : 'Active',
                        });
                      }}
                      className="text-xs font-semibold text-[#714B67] hover:underline"
                    >
                      Toggle Status
                    </button>
                  </div>
                ),
              },
            ]}
            data={departments}
            emptyMessage="No departments configured yet."
          />
        </div>
      )}

      {/* Tab B: Asset Category Management */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setCategoryModalOpen(true)}
              className="flex items-center gap-1.5 rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53] transition-colors"
            >
              <Plus size={14} />
              Add Category
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Left list */}
            <div className="md:col-span-2 space-y-4">
              <DataTable
                columns={[
                  { header: 'Category Name', accessor: (row) => row.name },
                  { header: 'Description', accessor: (row) => row.description || 'None' },
                  { header: 'Custom Fields', accessor: (row) => row.fields?.length || 0 },
                  { header: 'Status', accessor: (row) => <StatusBadge status={row.status} /> },
                ]}
                data={categories}
                onRowClick={(row) => setSelectedCategory(row)}
                emptyMessage="No asset categories configured yet."
              />
            </div>

            {/* Right details / custom fields builder */}
            <div className="rounded-sm border border-[#E3E3E6] bg-white p-4">
              {selectedCategory ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-[#1F1F1F] uppercase tracking-wider">{selectedCategory.name}</h3>
                    <p className="text-xs text-[#6C757D] mt-1">{selectedCategory.description || 'No description'}</p>
                  </div>

                  <div className="border-t border-[#E3E3E6] pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider">
                        Category Custom Fields
                      </span>
                      <button
                        onClick={() => setFieldModalOpen(true)}
                        className="text-xs font-semibold text-[#714B67] hover:underline flex items-center gap-1"
                      >
                        <Plus size={12} /> Add Field
                      </button>
                    </div>

                    <div className="space-y-2">
                      {selectedCategory.fields?.length === 0 ? (
                        <p className="text-xs text-[#6C757D] italic">No custom fields defined.</p>
                      ) : (
                        selectedCategory.fields?.map((f) => (
                          <div key={f.id} className="flex justify-between border border-[#E3E3E6] p-2 rounded-sm bg-gray-50">
                            <div>
                              <div className="font-semibold text-xs text-[#1F1F1F]">{f.field_name}</div>
                              <div className="text-[10px] text-[#6C757D] capitalize">{f.field_type}</div>
                            </div>
                            {f.required && (
                              <span className="text-[9px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                                Required
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-[#6C757D] text-xs">
                  Select a category from the list to manage custom fields.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab C: Employee Directory */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <DataTable
            columns={[
              { header: 'Employee Name', accessor: (row) => row.name },
              { header: 'Email', accessor: (row) => row.email },
              { header: 'Department', accessor: (row) => row.department?.name || 'Unassigned' },
              { header: 'System Role', accessor: (row) => <span className="text-xs font-medium text-[#714B67]">{row.role}</span> },
              { header: 'Status', accessor: (row) => <StatusBadge status={row.status} /> },
              {
                header: 'Action / Promote',
                accessor: (row) => (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEmployeeModal(row)}
                      className="text-[#6C757D] hover:text-[#714B67] p-1 rounded-sm hover:bg-gray-100"
                    >
                      <UserCog size={14} />
                    </button>
                    {row.role === 'Employee' ? (
                      <>
                        <button
                          onClick={() => promoteEmployeeMutation.mutate({ id: row.id, role: 'Department Head' })}
                          className="text-[10px] text-green-600 border border-green-200 px-1.5 py-0.5 rounded-sm hover:bg-green-50 flex items-center gap-1 font-medium"
                        >
                          <UserCheck size={10} /> + Head
                        </button>
                        <button
                          onClick={() => promoteEmployeeMutation.mutate({ id: row.id, role: 'Asset Manager' })}
                          className="text-[10px] text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded-sm hover:bg-indigo-50 flex items-center gap-1 font-medium"
                        >
                          <UserCheck size={10} /> + Manager
                        </button>
                      </>
                    ) : (
                      row.role !== 'Admin' && (
                        <button
                          onClick={() => revokeEmployeeMutation.mutate(row.id)}
                          className="text-[10px] text-red-600 border border-red-200 px-1.5 py-0.5 rounded-sm hover:bg-red-50 flex items-center gap-1 font-medium"
                        >
                          <UserMinus size={10} /> Revoke
                        </button>
                      )
                    )}
                  </div>
                ),
              },
            ]}
            data={employees}
            emptyMessage="No employees found in directory."
          />
        </div>
      )}

      {/* Department Modal */}
      <Modal
        isOpen={deptModalOpen}
        onClose={() => setDeptModalOpen(false)}
        title={editingDept ? 'Edit Department' : 'Create Department'}
        footer={
          <>
            <button
              onClick={() => setDeptModalOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDept}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Save Department
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Department Name
            </label>
            <input
              type="text"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
              placeholder="e.g. Facilities Management"
            />
            {deptErrors.name && <span className="text-[10px] text-red-500 mt-0.5 block">{deptErrors.name}</span>}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Department Head / Manager
            </label>
            <select
              value={deptHeadId}
              onChange={(e) => setDeptHeadId(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none bg-white"
            >
              <option value="">Unassigned</option>
              {employees
                .filter((emp) => emp.role === 'Department Head')
                .map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Parent Department
            </label>
            <select
              value={deptParentId}
              onChange={(e) => setDeptParentId(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none bg-white"
            >
              <option value="">None (Top Level)</option>
              {departments
                .filter((d) => !editingDept || d.id !== editingDept.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
            {deptErrors.parent && <span className="text-[10px] text-red-500 mt-0.5 block">{deptErrors.parent}</span>}
          </div>
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="Add Asset Category"
        footer={
          <>
            <button
              onClick={() => setCategoryModalOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCategory}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Save Category
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Category Name
            </label>
            <input
              type="text"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
              placeholder="e.g. IT Electronics"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67] h-20 resize-none"
              placeholder="Provide a brief summary"
            />
          </div>
        </div>
      </Modal>

      {/* Custom Field Modal */}
      <Modal
        isOpen={fieldModalOpen}
        onClose={() => setFieldModalOpen(false)}
        title="Add Custom Category Field"
        footer={
          <>
            <button
              onClick={() => setFieldModalOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveField}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Add Field
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Field Name
            </label>
            <input
              type="text"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none focus:border-[#714B67]"
              placeholder="e.g. Warranty Period (months)"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
              Field Type
            </label>
            <select
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value)}
              className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none bg-white"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="reqCheck"
              checked={fieldRequired}
              onChange={(e) => setFieldRequired(e.target.checked)}
              className="h-4 w-4 rounded-sm border-[#E3E3E6] text-[#714B67] focus:ring-[#714B67]"
            />
            <label htmlFor="reqCheck" className="text-xs font-medium text-[#1F1F1F] select-none">
              Mark as required validation
            </label>
          </div>
        </div>
      </Modal>

      {/* Employee Edit Modal */}
      <Modal
        isOpen={employeeModalOpen}
        onClose={() => setEmployeeModalOpen(false)}
        title="Edit Employee Details"
        footer={
          <>
            <button
              onClick={() => setEmployeeModalOpen(false)}
              className="rounded-sm border border-[#E3E3E6] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEmployee}
              className="rounded-sm bg-[#714B67] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B3B53]"
            >
              Save Details
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {selectedEmployee && (
            <>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">Name</span>
                <span className="text-xs font-medium text-[#1F1F1F]">{selectedEmployee.name}</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                  Department Assignment
                </label>
                <select
                  value={empDeptId}
                  onChange={(e) => setEmpDeptId(e.target.value)}
                  className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none bg-white"
                >
                  <option value="">Unassigned</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                  Account Status
                </label>
                <select
                  value={empStatus}
                  onChange={(e) => setEmpStatus(e.target.value)}
                  className="w-full rounded-sm border border-[#E3E3E6] px-3 py-2 text-xs outline-none bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
