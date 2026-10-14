'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Edit, Trash2, X, List, Network } from 'lucide-react';
import { createAccount, updateAccount, deleteAccount } from './actions';
import { toast } from 'react-hot-toast';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import AccountTree from './account-tree';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type AccountRecord = {
  id: string;
  code: string | null;
  name: string;
  type: string;
  parentId: string | null;
  parent?: { id: string; code: string | null; name: string } | null;
  isGroup: boolean;
  isSystem: boolean;
  balance?: number;
};

type AccountFormData = {
  code?: string;
  name?: string;
  type?: string;
  parentId?: string;
  isGroup?: boolean;
};

export default function DataSettingsTabs({ accounts }: { accounts: AccountRecord[] }) {
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedData, setSelectedData] = useState<AccountRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({
    isOpen: false,
    id: '',
  });
  const [formData, setFormData] = useState<AccountFormData>({});
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = (mode: 'create' | 'edit', data: AccountRecord | null = null) => {
    setModalMode(mode);
    setSelectedData(data);
    setFormData(
      data
        ? {
            code: data.code || '',
            name: data.name,
            type: data.type,
            parentId: data.parentId || '',
            isGroup: data.isGroup,
          }
        : {
            code: '',
            name: '',
            type: 'INCOME',
            parentId: '',
            isGroup: false,
          }
    );
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedData(null);
    setFormData({});
  };

  const handleDelete = async () => {
    try {
      await deleteAccount(deleteConfirm.id);
      toast.success('Account deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete account');
    } finally {
      setDeleteConfirm({ isOpen: false, id: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: formData.name || '',
        code: formData.code || '',
        type: formData.type || 'INCOME',
        parentId: formData.parentId || undefined,
        isGroup: Boolean(formData.isGroup),
      };

      const result =
        modalMode === 'create'
          ? await createAccount(payload)
          : await updateAccount(selectedData!.id, payload);

      if (result?.error) {
        throw new Error(result.error);
      }

      handleCloseModal();
      toast.success(`Account ${modalMode === 'create' ? 'created' : 'updated'} successfully!`);
    } catch (error: any) {
      toast.error(error.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <TooltipProvider delayDuration={200}>
        <div className="bg-card rounded-lg shadow-sm border border-border min-h-[400px]">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-medium text-foreground">Chart of Accounts</h3>
                <div className="flex items-center bg-accent rounded-md p-1 border border-border">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-sm transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        aria-label="List View"
                        type="button"
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>List View</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode('tree')}
                        className={`p-1.5 rounded-sm transition-colors ${viewMode === 'tree' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        aria-label="Tree View"
                        type="button"
                      >
                        <Network className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Tree View</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <button
                onClick={() => handleOpenModal('create')}
                className="inline-flex items-center px-4 py-2 bg-minia-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-minia-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Account
              </button>
            </div>

            {viewMode === 'tree' ? (
              <div className="border border-border rounded-md p-4 bg-card/50">
                <AccountTree
                  accounts={accounts}
                  onEdit={(acc) => handleOpenModal('edit', acc)}
                  onDelete={(id) => setDeleteConfirm({ isOpen: true, id })}
                />
              </div>
            ) : (
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Parent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Group</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {accounts.map((account) => (
                    <tr key={account.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{account.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{account.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        <span className="px-2 py-1 text-xs rounded bg-accent text-muted-foreground">
                          {account.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {account.parent ? (
                          <span className="text-foreground font-medium">
                            {account.parent.code ? `${account.parent.code} - ` : ''}{account.parent.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {account.isGroup ? (
                          <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 font-medium">
                            Group
                          </span>
                        ) : account.parentId ? (
                          <span className="text-xs text-muted-foreground">Child</span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-medium">
                        {account.isGroup ? (
                          <span className="text-muted-foreground/40 text-xs italic">—</span>
                        ) : (
                          <Link
                            href={`/reports/general-ledger?accountId=${account.id}`}
                            title="View General Ledger"
                            className={cn(
                              "hover:underline",
                              Number(account.balance || 0) < 0
                                ? "text-rose-600 dark:text-rose-400 font-semibold"
                                : "text-emerald-700 dark:text-emerald-400 font-semibold"
                            )}
                          >
                            Rs {Number(account.balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Link>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleOpenModal('edit', account)}
                                className="text-minia-primary hover:text-minia-primary/80"
                                aria-label="Edit"
                                type="button"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>Edit</p>
                            </TooltipContent>
                          </Tooltip>

                          {!account.isSystem && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setDeleteConfirm({ isOpen: true, id: account.id })}
                                  className="text-minia-danger hover:text-minia-danger/80"
                                  aria-label="Delete"
                                  type="button"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>Delete</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </TooltipProvider>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: '' })}
        onConfirm={handleDelete}
        title="Delete Account"
        message="Are you sure you want to delete this account? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card rounded-lg shadow-xl border border-border w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-foreground">
                {modalMode === 'create' ? 'Add' : 'Edit'} Account
              </h3>
              <button onClick={handleCloseModal} className="text-muted-foreground hover:text-foreground" type="button">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">Code</label>
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                  placeholder="1001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                  placeholder="Sales Income"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">Type</label>
                <select
                  required
                  value={formData.type || 'INCOME'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                >
                  <option value="ASSET">Asset</option>
                  <option value="LIABILITY">Liability</option>
                  <option value="EQUITY">Equity</option>
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">Parent Account</label>
                <select
                  value={formData.parentId || ''}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                >
                  <option value="">None</option>
                  {accounts
                    .filter((acc) => acc.id !== selectedData?.id && acc.isGroup)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code ? `${acc.code} - ` : ''}{acc.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex items-center">
                <input
                  id="isGroup"
                  type="checkbox"
                  checked={formData.isGroup || false}
                  onChange={(e) => setFormData({ ...formData, isGroup: e.target.checked })}
                  className="h-4 w-4 text-minia-primary focus:ring-minia-primary border-input rounded bg-background"
                />
                <label htmlFor="isGroup" className="ml-2 block text-sm text-foreground">
                  Is Group Account
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground bg-minia-primary rounded-md hover:bg-minia-primary/90 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
