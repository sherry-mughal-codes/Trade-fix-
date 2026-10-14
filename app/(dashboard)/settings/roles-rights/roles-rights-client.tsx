"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { clearPermissionsCache } from "@/lib/use-permissions";
import { createRole, deleteRole, renameRole, saveRolePermissions } from "./actions";

type RoleRow = { id: string; name: string; isSystem: boolean };
type PermissionRow = { id: string; key: string; label: string; group: string; order: number };

export default function RolesRightsClient({
  roles,
  permissions,
  allowed,
}: {
  roles: RoleRow[];
  permissions: PermissionRow[];
  allowed: Record<string, Record<string, boolean>>;
}) {
  const [isPending, startTransition] = useTransition();
  const [newRoleName, setNewRoleName] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState("");
  const [draft, setDraft] = useState<Record<string, Record<string, boolean>>>(allowed);
  const [dirty, setDirty] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<RoleRow | null>(null);

  const grouped = useMemo(() => {
    const groups = new Map<string, PermissionRow[]>();
    for (const p of permissions) {
      if (!groups.has(p.group)) groups.set(p.group, []);
      groups.get(p.group)!.push(p);
    }
    for (const [k, list] of Array.from(groups.entries())) {
      list.sort((a, b) => (a.order || 0) - (b.order || 0) || a.label.localeCompare(b.label));
      groups.set(k, list);
    }
    return Array.from(groups.entries());
  }, [permissions]);

  const toggle = (roleId: string, permissionId: string) => {
    setDraft((prev) => {
      const next = { ...prev, [roleId]: { ...(prev[roleId] || {}) } };
      next[roleId][permissionId] = !Boolean(next[roleId][permissionId]);
      return next;
    });
    setDirty(true);
  };

  const setAllForRole = (roleId: string, value: boolean) => {
    setDraft((prev) => {
      const next = { ...prev, [roleId]: { ...(prev[roleId] || {}) } };
      for (const p of permissions) {
        next[roleId][p.id] = value;
      }
      return next;
    });
    setDirty(true);
  };

  const onDiscard = () => {
    setDraft(allowed);
    setDirty(false);
    setEditingRoleId(null);
    setEditingRoleName("");
    setNewRoleName("");
  };

  const onSave = () => {
    const updates: Array<{ roleId: string; permissionId: string; allowed: boolean }> = [];
    for (const role of roles) {
      for (const p of permissions) {
        const val = Boolean(draft?.[role.id]?.[p.id]);
        updates.push({ roleId: role.id, permissionId: p.id, allowed: val });
      }
    }

    startTransition(async () => {
      const res: any = await saveRolePermissions({ updates });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      clearPermissionsCache();
      toast.success("Roles & rights saved");
      setDirty(false);
    });
  };

  const onCreateRole = () => {
    startTransition(async () => {
      const res: any = await createRole(newRoleName);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Role added");
      setNewRoleName("");
    });
  };

  const onStartRename = (role: RoleRow) => {
    if (role.isSystem) {
      toast.error("System roles cannot be renamed");
      return;
    }
    setEditingRoleId(role.id);
    setEditingRoleName(role.name);
  };

  const onConfirmRename = () => {
    if (!editingRoleId) return;
    startTransition(async () => {
      const res: any = await renameRole(editingRoleId, editingRoleName);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Role renamed");
      setEditingRoleId(null);
      setEditingRoleName("");
    });
  };

  const onDeleteRole = (role: RoleRow) => {
    if (role.isSystem) {
      toast.error("System roles cannot be deleted");
      return;
    }
    setPendingDelete(role);
  };

  const confirmDeleteRole = () => {
    const role = pendingDelete;
    if (!role) return;
    setPendingDelete(null);
    startTransition(async () => {
      const res: any = await deleteRole(role.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      clearPermissionsCache();
      toast.success("Role deleted");
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Roles & Rights</h1>
          <p className="text-sm text-muted-foreground">Manage permissions per role</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="New role name"
            className="h-10 px-3 border border-input bg-background text-foreground rounded-md"
          />
          <button
            type="button"
            onClick={onCreateRole}
            disabled={isPending || !newRoleName.trim()}
            className="h-10 px-4 bg-minia-primary text-white text-sm font-medium rounded-md disabled:opacity-50"
          >
            + Add Role
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={isPending || (!dirty && !editingRoleId && !newRoleName)}
            className="h-10 px-4 bg-background border border-input text-foreground text-sm font-medium rounded-md hover:bg-accent disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isPending || !dirty}
            className="h-10 px-4 bg-minia-primary text-white text-sm font-medium rounded-md disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {editingRoleId ? (
        <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="text-sm text-muted-foreground">Rename role</div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <input
              value={editingRoleName}
              onChange={(e) => setEditingRoleName(e.target.value)}
              className="h-10 px-3 border border-input bg-background text-foreground rounded-md"
            />
            <button
              type="button"
              onClick={onConfirmRename}
              disabled={isPending || !editingRoleName.trim()}
              className="h-10 px-4 bg-minia-primary text-white text-sm font-medium rounded-md disabled:opacity-50"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingRoleId(null);
                setEditingRoleName("");
              }}
              disabled={isPending}
              className="h-10 px-4 bg-background border border-input text-foreground text-sm font-medium rounded-md hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-3.5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide min-w-[180px]">Permission</th>
              {roles.map((role) => (
                <th key={role.id} className="px-2.5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide align-top min-w-[90px]">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-foreground text-xs font-semibold normal-case truncate" title={role.name}>{role.name}</span>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onStartRename(role)}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        title="Rename"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRole(role)}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAllForRole(role.id, true)}
                      className="text-minia-primary hover:underline"
                    >
                      All
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => setAllForRole(role.id, false)}
                      className="text-muted-foreground hover:underline"
                    >
                      None
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {grouped.map(([group, perms]) => (
              <Fragment key={group}>
                <tr key={group} className="bg-accent/30">
                  <td className="px-3.5 py-2 text-xs font-semibold text-foreground">{group}</td>
                  {roles.map((r) => (
                    <td key={`${group}-${r.id}`} className="px-2 py-2" />
                  ))}
                </tr>
                {perms.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3.5 py-2">
                      <div className="text-sm font-medium text-foreground">{p.label}</div>
                      <div className="text-xs text-muted-foreground">{p.key}</div>
                    </td>
                    {roles.map((r) => {
                      const isOn = Boolean(draft?.[r.id]?.[p.id]);
                      return (
                        <td key={`${p.id}-${r.id}`} className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggle(r.id, p.id)}
                            className={
                              isOn
                                ? "inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-minia-primary/15 text-minia-primary border border-minia-primary/30 min-w-[60px]"
                                : "inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-muted text-muted-foreground border border-border min-w-[60px]"
                            }
                          >
                            <span className={isOn ? "h-2 w-2 rounded-full bg-minia-primary" : "h-2 w-2 rounded-full bg-muted-foreground/40"} />
                            {isOn ? "On" : "Off"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDeleteRole}
        title={`Delete role "${pendingDelete?.name || ""}"?`}
        message="All user assignments and permission selections for this role will be removed. This cannot be undone."
        confirmText="Delete role"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
