"use client";

import { useState, useTransition } from "react";
import { toast } from "react-hot-toast";

import { changeMyPassword } from "./actions";

export default function ProfileClient() {
  const [isPending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const onSubmit = () => {
    if (!currentPassword) {
      toast.error("Current password is required");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    startTransition(async () => {
      const res: any = await changeMyPassword(currentPassword, newPassword);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    });
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow-sm border border-border space-y-3">
      <div className="text-sm font-semibold text-foreground">Change Password</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Current password</div>
          <input
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            className="h-10 px-3 border border-input bg-background text-foreground rounded-md w-full"
            placeholder="Current password"
          />
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">New password</div>
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            className="h-10 px-3 border border-input bg-background text-foreground rounded-md w-full"
            placeholder="New password"
          />
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Confirm password</div>
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            className="h-10 px-3 border border-input bg-background text-foreground rounded-md w-full"
            placeholder="Confirm password"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending}
          className="h-10 px-4 bg-minia-primary text-white text-sm font-medium rounded-md disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

