import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfileClient from "./profile-client";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/login");
  }
  const name = session?.user?.name || "";
  const email = session?.user?.email || "";
  const username = session?.user?.username || "";
  const roleLabel = session?.user?.isSuperadmin
    ? "Superadmin"
    : session?.user?.roles?.map((r) => r.name).join(", ") || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account details</p>
      </div>

      <div className="bg-card p-4 rounded-lg shadow-sm border border-border space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="text-sm text-muted-foreground">Name</div>
          <div className="sm:col-span-2 text-sm text-foreground">{name || "-"}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="text-sm text-muted-foreground">Username</div>
          <div className="sm:col-span-2 text-sm text-foreground">{username || "-"}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="text-sm text-muted-foreground">Email</div>
          <div className="sm:col-span-2 text-sm text-foreground">{email || "-"}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="text-sm text-muted-foreground">Role</div>
          <div className="sm:col-span-2 text-sm text-foreground">{roleLabel || "-"}</div>
        </div>
      </div>

      <ProfileClient />
    </div>
  );
}
