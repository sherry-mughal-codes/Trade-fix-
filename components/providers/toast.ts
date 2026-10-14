"use client";

import toast, { ToastOptions } from "react-hot-toast";
import type { ActionResult, ActionResultFail } from "@/lib/action-result";
import { isAppError, toUserMessage, AppError } from "@/lib/errors";

function buildToastText(fail: ActionResultFail): { title: string; body: string | null } {
  switch (fail.code) {
    case "FORBIDDEN":
      return {
        title: fail.permissionLabel ? `Permission required: ${fail.permissionLabel}` : "Permission required",
        body: fail.detail ?? (fail.permissionKey ? `Required key: ${fail.permissionKey}. Ask your admin for access.` : "Ask your admin to grant the required right."),
      };
    case "NOT_AUTHENTICATED":
      return { title: "Signed out", body: "Please sign in and try again." };
    case "NOT_FOUND":
      return {
        title: `${fail.recordType ?? "Record"} not found`,
        body: fail.detail ?? "It may have been deleted or you may have opened an old link.",
      };
    case "NOT_OWNED":
      return {
        title: "Not your record",
        body: `This ${(fail.recordType ?? "record").toLowerCase()} doesn't belong to your organization.`,
      };
    case "ORG_REQUIRED":
      return { title: "Select an organization", body: "Go to /orgs and pick your organization first." };
    case "SHIFT_REQUIRED":
      return { title: "Open a shift", body: fail.detail ?? "Open a cashier shift before saving or checking out." };
    case "SHIFT_CLOSED":
      return {
        title: "Shift closed",
        body: fail.detail ?? "This shift was closed by a Z Report. Open a new shift to continue trading.",
      };
    case "VALIDATION":
      return { title: "Could not save", body: fail.detail ?? fail.error };
    case "DUPLICATE":
      return {
        title: "Duplicate value",
        body: fail.error,
      };
    case "REFERENCE_RESTRICTED":
      return {
        title: "Cannot change this record",
        body: fail.error,
      };
    case "CONFIGURATION":
      return {
        title: "Setup incomplete",
        body: fail.error,
      };
    case "INTERNAL":
    default:
      return {
        title: "Something went wrong",
        body: fail.detail ?? fail.error ?? "Please try again in a moment.",
      };
  }
}

export function toastActionError(
  result: ActionResultFail | ActionResult | unknown,
  opts: { fallback?: string; durationMs?: number } = {},
): string | null {
  if (!result) {
    return toast.error(opts.fallback ?? "Something went wrong.");
  }
  if (typeof result === "object" && "ok" in result && (result as any).ok === false) {
    const fail = result as ActionResultFail;
    const { title, body } = buildToastText(fail);
    const msg = body ? `${title}\n${body}` : title;
    const tOpts: ToastOptions = { duration: opts.durationMs ?? (fail.code === "FORBIDDEN" ? 6000 : 4500) };
    if (fail.code === "VALIDATION" || fail.code === "DUPLICATE" || fail.code === "REFERENCE_RESTRICTED") {
      return toast.error(msg, tOpts);
    }
    return toast.error(msg, tOpts);
  }
  if (typeof result === "string") {
    return toast.error(result);
  }
  const fallback = opts.fallback ?? "Something went wrong. Please try again.";
  return toast.error(toUserMessage(result, fallback));
}

export function toastUnknownError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  return toast.error(toUserMessage(err, fallback));
}

export function toastAppErrorOrMessage(err: unknown, fallback?: string): string {
  if (isAppError(err)) {
    const ae = err as AppError;
    const msg = ae.hint ? `${ae.message}\n(${ae.hint})` : ae.message;
    return toast.error(msg, { duration: ae.code === "FORBIDDEN" ? 6000 : 4500 });
  }
  return toast.error(toUserMessage(err, fallback ?? "Something went wrong."));
}

export { toast as toastRaw };
