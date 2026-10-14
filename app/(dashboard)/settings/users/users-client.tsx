"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "react-hot-toast";
import { createUser, resetUserPassword, setUserActive, updateUserRoles } from "./actions";

type RoleRow = { id: string; name: string };
type UserRow = {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  isActive: boolean;
  isSuperadmin: boolean;
  roleIds: string[];
  roleNames: string[];
};

export default function UsersClient({
  roles,
  users,
  currentUserId,
}: {
  roles: RoleRow[];
  users: UserRow[];
  currentUserId: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const resetUser = useMemo(() => users.find((u) => u.id === resetUserId) || null, [resetUserId, users]);

  const onCreate = () => {
    startTransition(async () => {
      const res: any = await createUser({ email, username, name, password, roleIds });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("User created");
      setEmail("");
      setUsername("");
      setName("");
      setPassword("");
      setRoleIds([]);
    });
  };

  const onChangeRoles = (userId: string, nextRoleIds: string[]) => {
    startTransition(async () => {
      const res: any = await updateUserRoles(userId, nextRoleIds);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Roles updated");
    });
  };

  const onToggleActive = (userId: string, next: boolean) => {
    startTransition(async () => {
      const res: any = await setUserActive(userId, next);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Status updated");
    });
  };

  const onConfirmReset = () => {
    if (!resetUserId) return;
    startTransition(async () => {
      const res: any = await resetUserPassword(resetUserId, resetPassword);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Password changed");
      setResetUserId(null);
      setResetPassword("");
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground">Create users and assign roles</p>
      </div>

      <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
        <div className="text-sm font-semibold text-foreground mb-3">Create User</div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 px-3 border border-input bg-background text-foreground rounded-md w-full"
              placeholder="Email"
              type="email"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-10 px-3 border border-input bg-background text-foreground rounded-md w-full"
              placeholder="Username"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 px-3 border border-input bg-background text-foreground rounded-md w-full"
              placeholder="Name"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 px-3 border border-input bg-background text-foreground rounded-md w-full"
              placeholder="Password"
              type="password"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Role</div>
            <select
              value={roleIds[0] || ""}
              onChange={(e) => setRoleIds(e.target.value ? [e.target.value] : [])}
              className="h-10 px-3 border border-input bg-background text-foreground rounded-md w-full"
            >
              <option value="">(none)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onCreate}
            disabled={isPending || (!email.trim() && !username.trim()) || !password}
            className="h-10 px-4 bg-minia-primary text-white text-sm font-medium rounded-md disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Username</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 text-sm text-foreground">{u.email || "-"}</td>
                <td className="px-4 py-3 text-sm text-foreground">{u.username || "-"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{u.name || "-"}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.roleIds[0] || ""}
                    disabled={isPending || u.isSuperadmin || u.id === currentUserId}
                    onChange={(e) => onChangeRoles(u.id, e.target.value ? [e.target.value] : [])}
                    className="min-w-[180px] h-10 px-3 border border-input bg-background text-foreground rounded-md"
                  >
                    <option value="">(none)</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-muted-foreground mt-1">
                    {u.isSuperadmin ? "superadmin" : u.roleNames.join(", ") || "(none)"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onToggleActive(u.id, !u.isActive)}
                    disabled={isPending || u.isSuperadmin || u.id === currentUserId}
                    className={
                      u.isActive
                        ? "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-minia-success/10 text-minia-success"
                        : "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground"
                    }
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setResetUserId(u.id);
                      setResetPassword("");
                    }}
                    disabled={isPending || u.isSuperadmin || u.id === currentUserId}
                    className="px-3 py-2 text-xs font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent disabled:opacity-50"
                  >
                    Change Password
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-muted-foreground text-center">
                  No users.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {resetUserId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-lg shadow-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="font-semibold text-foreground">Change Password</div>
              <button
                type="button"
                onClick={() => setResetUserId(null)}
                className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded"
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-muted-foreground">{resetUser?.email || resetUser?.username || resetUser?.name || "-"}</div>
              <input
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                type="password"
                placeholder="New password"
                className="h-10 px-3 border border-input bg-background text-foreground rounded-md w-full"
              />
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetUserId(null)}
                disabled={isPending}
                className="h-10 px-4 bg-background border border-input text-foreground text-sm font-medium rounded-md hover:bg-accent disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmReset}
                disabled={isPending || resetPassword.length < 6}
                className="h-10 px-4 bg-minia-primary text-white text-sm font-medium rounded-md disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
