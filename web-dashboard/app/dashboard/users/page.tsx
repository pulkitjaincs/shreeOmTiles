'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { apiRequest, cachedApiRequest } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import {
  UserPlus,
  Shield,
  Trash2,
  KeyRound,
  Pencil,
  CheckCircle,
  Search,
  X,
  AlertTriangle,
  Phone,
  UserCheck,
  Lock,
  Truck,
  Boxes,
  UserX,
} from 'lucide-react';
import { StaffUser } from '@/components/users/types';
import { UserStatsGrid } from '@/components/users/user-stats-grid';

import { UserFormModal } from '@/components/users/user-form-modal';
import { ResetPasswordModal } from '@/components/users/reset-password-modal';
import { DeleteUserModal } from '@/components/users/delete-user-modal';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<StaffUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<StaffUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<StaffUser | null>(null);

  const loadUsers = useCallback(async (force = false) => {
    try {
      const data = await cachedApiRequest<StaffUser[]>('/users', {
        forceRefresh: force,
        onRevalidate: (fresh) => setUsers(fresh),
      });
      setUsers(data);
    } catch (err: unknown) {
      console.error(err);
      setBannerMessage({ type: 'error', text: (err as Error).message || 'Failed to load staff list' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    const handleRefresh = () => {
      loadUsers(true);
    };
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => window.removeEventListener('app:refresh-active-page', handleRefresh);
  }, [loadUsers]);

  // Toggle Active / Inactive Status
  const toggleStatus = async (user: StaffUser) => {
    if (user.role === 'OWNER') {
      alert('The business director account cannot be marked inactive.');
      return;
    }

    const nextStatus = !user.isActive;
    const actionText = nextStatus ? 'activate' : 'deactivate and block from logging in';
    if (!confirm(`Are you sure you want to ${actionText} ${user.name}?`)) {
      return;
    }

    try {
      await apiRequest(`/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus }),
      });
      setBannerMessage({
        type: 'success',
        text: `✓ ${user.name} has been marked ${nextStatus ? 'ACTIVE' : 'INACTIVE'}. ${
          nextStatus ? 'They can now log in and receive assignments.' : 'They can no longer log in or receive deliveries.'
        }`,
      });
      await loadUsers();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to update user status');
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      // Status filter
      if (statusFilter === 'ACTIVE' && !u.isActive) return false;
      if (statusFilter === 'INACTIVE' && u.isActive) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesPhone = u.phone.toLowerCase().includes(q);
        const matchesRole = u.role.toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesRole;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  // Counts
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const inactive = users.filter((u) => !u.isActive).length;
    const drivers = users.filter((u) => u.role === 'DRIVER' && u.isActive).length;
    return { total, active, inactive, drivers };
  }, [users]);

  if (currentUser?.role !== 'OWNER') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Shield className="h-16 w-16 mb-4 opacity-50 text-primary" />
        <h2 className="text-xl font-bold text-foreground mb-2">Access Restricted</h2>
        <p className="text-sm">Only the Business Director has authority to manage staff members and system credentials.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Staff & Credential Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-500/30">
              Director Panel
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your employees, edit mobile numbers and passwords, toggle access, or remove staff members.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99]"
          >
            <UserPlus className="h-4 w-4" />
            Add Staff Member
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {bannerMessage && (
        <div
          className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-medium shadow-md animate-in fade-in ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300'
          }`}
        >
          {bannerMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-500 dark:text-rose-400 shrink-0" />
          )}
          <span className="flex-1 font-medium">{bannerMessage.text}</span>
          <button onClick={() => setBannerMessage(null)} className="hover:text-foreground text-muted-foreground p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top Staff Metrics */}
      <UserStatsGrid stats={stats} />

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card/75 backdrop-blur-xl p-3 rounded-2xl border border-border/80 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter Tabs */}
          <button
            onClick={() => setRoleFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              roleFilter === 'ALL'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            All Roles
          </button>
          <button
            onClick={() => setRoleFilter('DRIVER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              roleFilter === 'DRIVER'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Truck className="h-3 w-3" />
            Drivers
          </button>
          <button
            onClick={() => setRoleFilter('SALESMAN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              roleFilter === 'SALESMAN'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            Salesmen
          </button>
          <button
            onClick={() => setRoleFilter('ADMIN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              roleFilter === 'ADMIN'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            Admins
          </button>
          <button
            onClick={() => setRoleFilter('SUPERVISOR')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              roleFilter === 'SUPERVISOR'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Boxes className="h-3 w-3" />
            Supervisors
          </button>
          <button
            onClick={() => setRoleFilter('WAREHOUSE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              roleFilter === 'WAREHOUSE'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            Warehouse
          </button>

          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            className="text-xs rounded-xl border border-border/80 bg-muted/60 text-foreground py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ml-1"
          >
            <option value="ALL" className="bg-card text-foreground">All Statuses</option>
            <option value="ACTIVE" className="bg-card text-foreground">Active Only</option>
            <option value="INACTIVE" className="bg-card text-foreground">Inactive Only</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search name, phone, role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border/80 bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Staff Table */}
      <div className="rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/80">
              <tr>
                <th className="py-3.5 px-4">Staff Member</th>
                <th className="py-3.5 px-4">Mobile Number</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Status & Access</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground text-xs">
                    Loading staff members...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground text-xs">
                    {searchQuery
                      ? 'No staff members matched your search.'
                      : 'No users registered under this filter.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isOwner = u.role === 'OWNER';
                  const isCurrentUser = u.id === currentUser?.id;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-muted/30 transition ${
                        !u.isActive ? 'bg-rose-500/5 opacity-75' : ''
                      }`}
                    >
                      {/* Name & Scope */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{u.name}</span>
                          {isCurrentUser && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
                              YOU
                            </span>
                          )}
                        </div>
                        {u.scope && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Boxes className="h-3 w-3 text-muted-foreground" />
                            <span>Scope: {u.scope}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Joined:{' '}
                          {new Date(u.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-foreground">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{u.phone}</span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4 align-top">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                            u.role === 'OWNER'
                              ? 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-500/30'
                              : u.role === 'ADMIN'
                              ? 'bg-primary/15 text-primary border border-primary/30'
                              : u.role === 'SUPERVISOR'
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30'
                              : u.role === 'DRIVER'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                              : u.role === 'WAREHOUSE'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {u.role === 'SUPERVISOR' && <Boxes className="h-3 w-3" />}
                          {u.role === 'DRIVER' && <Truck className="h-3 w-3" />}
                          {u.role === 'OWNER' ? 'DIRECTOR' : u.role}
                        </span>
                      </td>

                      {/* Status Toggle & Explanation */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="space-y-1">
                          {isOwner ? (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Active (Director Protected)
                            </span>
                          ) : (
                            <button
                              onClick={() => toggleStatus(u)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition ${
                                u.isActive
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                              }`}
                              title={
                                u.isActive
                                  ? 'Click to deactivate staff member (blocks login and delivery assignments)'
                                  : 'Click to activate staff member (re-enables login and assignments)'
                              }
                            >
                              {u.isActive ? (
                                <>
                                  <UserCheck className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                                  <span>Active (Allowed)</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                                  <span>Inactive (Blocked)</span>
                                </>
                              )}
                            </button>
                          )}

                          <div className="text-[10px] text-muted-foreground">
                            {u.isActive
                              ? u.role === 'DRIVER'
                                ? 'Eligible for delivery assignments'
                                : 'Can log in & perform role tasks'
                              : 'Blocked from login & assignments'}
                          </div>
                        </div>
                      </td>

                      {/* Actions: Edit Profile, Reset Password, Remove */}
                      <td className="py-3.5 px-4 text-right align-top">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. Edit Profile / Phone */}
                          <button
                            onClick={() => setEditUser(u)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition"
                            title="Edit staff name, mobile number or role"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          {/* 2. Reset Password */}
                          <button
                            onClick={() => setPasswordUser(u)}
                            className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-500/15 border border-amber-500/30 transition"
                            title="Change or reset password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>

                          {/* 3. Remove Staff (NOT ALLOWED for Owner) */}
                          {!isOwner && !isCurrentUser ? (
                            <button
                              onClick={() => setDeleteUser(u)}
                              className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-500/15 border border-rose-500/30 transition"
                              title="Remove staff member from system"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span
                              className="p-1.5 text-muted-foreground/40 cursor-not-allowed"
                              title="Director account cannot be removed"
                            >
                              <Lock className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. ADD / EDIT STAFF MODAL */}
      <UserFormModal
        isOpen={isAddOpen || Boolean(editUser)}
        user={editUser}
        onClose={() => {
          setIsAddOpen(false);
          setEditUser(null);
        }}
        onSuccess={async (msg) => {
          setBannerMessage({ type: 'success', text: msg });
          await loadUsers();
        }}
      />

      {/* 2. RESET PASSWORD MODAL */}
      <ResetPasswordModal
        user={passwordUser}
        onClose={() => setPasswordUser(null)}
        onSuccess={async (msg) => {
          setBannerMessage({ type: 'success', text: msg });
        }}
      />

      {/* 3. CONFIRM REMOVE STAFF MODAL */}
      <DeleteUserModal
        user={deleteUser}
        onClose={() => setDeleteUser(null)}
        onSuccess={async (msg) => {
          setBannerMessage({ type: 'success', text: msg });
          await loadUsers();
        }}
      />
    </div>
  );
}
