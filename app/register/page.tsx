import { requireRegisterAccess } from "./access";
import { getCurrentShiftContext } from "../(dashboard)/pos/actions";
import ShiftOpenForm from "../(dashboard)/pos/_components/shift-open-form";
import POSMain from "../(dashboard)/pos/_components/pos-main";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  await requireRegisterAccess();

  const { openShift, availableProfiles, companySettings } = await getCurrentShiftContext();

  if (!openShift && availableProfiles.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground">No POS Profiles Assigned</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Contact your administrator to assign a POS profile to your user before opening a counter.
          </p>
        </div>
      </div>
    );
  }

  if (!openShift) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6 bg-background">
        <ShiftOpenForm availableProfiles={availableProfiles as any[]} />
      </div>
    );
  }

  return (
    <POSMain
      initialShift={openShift as any}
      initialCompanySettings={companySettings as any}
    />
  );
}
