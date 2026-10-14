import { AppError, ErrorCode, isNextNotFound, isNextRedirect, logErrorOnServer, toAppError } from "@/lib/errors";

export type ActionResultOk<T> = { ok: true; data?: T };

export type ActionResultFail = {
  ok: false;
  code: ErrorCode;
  error: string;
  detail?: string;
  permissionKey?: string;
  permissionLabel?: string;
  recordType?: string;
  duplicateField?: string;
};

export type ActionResult<T = unknown> = ActionResultOk<T> | ActionResultFail;

export function isActionResult(v: unknown): v is ActionResult {
  return !!v && typeof v === "object" && typeof (v as any).ok === "boolean" && "ok" in (v as any);
}

export function actionOk<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail(
  code: ErrorCode,
  error: string,
  extras?: Partial<Omit<ActionResultFail, "ok" | "code" | "error">>,
): ActionResultFail {
  return { ok: false, code, error, ...extras };
}

export async function withActionError<T>(
  label: string,
  fn: () => Promise<T> | T,
): Promise<ActionResult<Awaited<T> extends void ? void : Awaited<T>>> {
  try {
    const out = await fn();
    return { ok: true, data: out as any } as any;
  } catch (err) {
    if (isNextRedirect(err) || isNextNotFound(err)) throw err;
    logErrorOnServer(label, err);
    const ae = toAppError(err);
    return actionFail(ae.code, ae.message, {
      detail: ae.detail,
      permissionKey: ae.permissionKey,
      permissionLabel: ae.permissionLabel,
      recordType: ae.recordType,
      duplicateField: ae.duplicateField,
    }) as any;
  }
}

export function fromLegacyError(error: string | null | undefined, fallbackCode: ErrorCode = "VALIDATION"): ActionResultFail {
  return actionFail(fallbackCode, error ?? "Something went wrong.");
}

export function appErrorToResult(err: unknown): ActionResultFail {
  const ae = toAppError(err);
  return actionFail(ae.code, ae.message, {
    detail: ae.detail,
    permissionKey: ae.permissionKey,
    permissionLabel: ae.permissionLabel,
    recordType: ae.recordType,
    duplicateField: ae.duplicateField,
  });
}

export type { ErrorCode };
export { AppError };
