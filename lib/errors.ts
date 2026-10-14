import { PERMISSIONS } from "@/lib/permissions";

export type ErrorCode =
  | "FORBIDDEN"
  | "NOT_AUTHENTICATED"
  | "NOT_FOUND"
  | "NOT_OWNED"
  | "ORG_REQUIRED"
  | "SHIFT_REQUIRED"
  | "SHIFT_CLOSED"
  | "VALIDATION"
  | "DUPLICATE"
  | "REFERENCE_RESTRICTED"
  | "CONFIGURATION"
  | "INTERNAL";

export type ReferenceRef = { label: string; count?: number };

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly detail?: string;
  public readonly hint?: string;
  public readonly permissionKey?: string;
  public readonly permissionLabel?: string;
  public readonly recordType?: string;
  public readonly recordId?: string;
  public readonly duplicateField?: string;
  public readonly references?: ReferenceRef[];
  public readonly missingField?: string;
  public readonly cause?: unknown;

  constructor(opts: {
    code: ErrorCode;
    message: string;
    detail?: string;
    hint?: string;
    permissionKey?: string;
    permissionLabel?: string;
    recordType?: string;
    recordId?: string;
    duplicateField?: string;
    references?: ReferenceRef[];
    missingField?: string;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = "AppError";
    this.code = opts.code;
    this.detail = opts.detail;
    this.hint = opts.hint;
    this.permissionKey = opts.permissionKey;
    this.permissionLabel = opts.permissionLabel;
    this.recordType = opts.recordType;
    this.recordId = opts.recordId;
    this.duplicateField = opts.duplicateField;
    this.references = opts.references;
    this.missingField = opts.missingField;
    this.cause = opts.cause;
    if (typeof (Error as any).captureStackTrace === "function") {
      (Error as any).captureStackTrace(this, AppError);
    }
  }

  static forbidden(permissionKey?: string, opts?: { detail?: string; hint?: string }): AppError {
    const def = PERMISSIONS.find((p) => p.key === permissionKey);
    const label = def?.label;
    const title = label
      ? `Permission required: ${label}`
      : permissionKey
        ? `Permission required: ${permissionKey}`
        : "Permission required";
    const body = permissionKey
      ? `You don't have permission to do this${label ? ` (${label})` : ` (${permissionKey})`}. Ask your admin to grant the required right.`
      : "You don't have permission to do this. Ask your admin for access.";
    return new AppError({
      code: "FORBIDDEN",
      message: body,
      detail: opts?.detail,
      hint: opts?.hint ?? label ? `Required key: ${permissionKey}` : undefined,
      permissionKey,
      permissionLabel: label,
    });
  }

  static notAuthenticated(opts?: { detail?: string }): AppError {
    return new AppError({
      code: "NOT_AUTHENTICATED",
      message: "You are not signed in. Please sign in and try again.",
      detail: opts?.detail,
      hint: "Go to /auth/login and re-authenticate.",
    });
  }

  static notFound(recordType = "Record", id?: string, opts?: { detail?: string }): AppError {
    return new AppError({
      code: "NOT_FOUND",
      message: `${recordType} not found${id ? ` (${id})` : ""}. It may have been deleted or you may have opened an old link.`,
      detail: opts?.detail,
      recordType,
      recordId: id,
    });
  }

  static notOwned(recordType = "Record", opts?: { detail?: string }): AppError {
    return new AppError({
      code: "NOT_OWNED",
      message: `This ${recordType.toLowerCase()} doesn't belong to your organization.`,
      detail: opts?.detail,
      recordType,
      hint: "Contact your admin if you expected to see this record.",
    });
  }

  static orgRequired(opts?: { detail?: string }): AppError {
    return new AppError({
      code: "ORG_REQUIRED",
      message: "Select an organization before continuing.",
      detail: opts?.detail,
      hint: "Go to /orgs and pick your organization.",
    });
  }

  static shiftRequired(opts?: { detail?: string; hint?: string; actionHint?: string }): AppError {
    const actionHint =
      opts?.actionHint ?? "saving the order or checking out";
    return new AppError({
      code: "SHIFT_REQUIRED",
      message: `Open a cashier shift before ${actionHint}.`,
      detail: opts?.detail,
      hint: opts?.hint ?? "Use POS → Open Shift first, then try again.",
    });
  }

  static shiftClosed(shiftNumber?: string | null, opts?: { detail?: string; hint?: string; actionHint?: string }): AppError {
    const actionHint = opts?.actionHint ?? "continue trading";
    const intro = shiftNumber
      ? `Cashier shift ${shiftNumber} is closed by a Z Report.`
      : "The cashier shift is closed by a Z Report.";
    return new AppError({
      code: "SHIFT_CLOSED",
      message: `${intro} Open a new shift to ${actionHint}.`,
      detail: opts?.detail,
      hint: opts?.hint ?? "Use POS → Open Shift to start a new counter shift.",
    });
  }

  static validation(message: string, opts?: { detail?: string }): AppError {
    return new AppError({
      code: "VALIDATION",
      message,
      detail: opts?.detail,
    });
  }

  static duplicate(field: string, opts?: { detail?: string }): AppError {
    const fieldLabel =
      {
        name: "Name",
        code: "Code",
        email: "Email",
        username: "Username",
        phone: "Phone",
      }[field.toLowerCase()] ?? field;
    return new AppError({
      code: "DUPLICATE",
      message: `${fieldLabel} already exists. Use a different ${fieldLabel.toLowerCase()}.`,
      detail: opts?.detail,
      duplicateField: field,
    });
  }

  static referenceRestricted(
    action: "delete" | "update" = "delete",
    recordType = "Record",
    refs: ReferenceRef[] = [],
    opts?: { detail?: string },
  ): AppError {
    const refsText = refs.length
      ? ": " +
        refs
          .map((r) => `${r.count ?? "linked"} ${r.label}${r.count && r.count !== 1 ? "s" : ""}`)
          .join(", ")
      : "";
    const verb = action === "delete" ? "delete" : "modify";
    return new AppError({
      code: "REFERENCE_RESTRICTED",
      message: `Cannot ${verb} this ${recordType.toLowerCase()} because it's used by other records${refsText}.`,
      detail: opts?.detail,
      recordType,
      references: refs,
    });
  }

  static configuration(missingField: string, opts?: { detail?: string; hint?: string }): AppError {
    return new AppError({
      code: "CONFIGURATION",
      message: `Setup is incomplete: ${missingField}. Ask your admin to finish configuration.`,
      detail: opts?.detail,
      missingField,
      hint: opts?.hint,
    });
  }

  static internal(message: string, cause?: unknown): AppError {
    return new AppError({
      code: "INTERNAL",
      message,
      cause,
    });
  }
}

export function isAppError(v: unknown): v is AppError {
  return !!v && v instanceof AppError;
}

const PRISMA_CODE_MAP: Record<string, ErrorCode> = {
  P2002: "DUPLICATE",
  P2003: "REFERENCE_RESTRICTED",
  P2014: "REFERENCE_RESTRICTED",
  P2015: "NOT_FOUND",
  P2025: "NOT_FOUND",
};

export type PrismaLikeError = {
  code?: string;
  meta?: { target?: unknown; modelName?: string; relationName?: string; cause?: string };
  message?: string;
};

function isPrismaError(v: unknown): v is PrismaLikeError {
  return !!(v && typeof v === "object" && (v as any).code && typeof (v as any).code === "string" && (v as any).code.startsWith("P"));
}

function humanizePrisma(err: PrismaLikeError): { code: ErrorCode; message: string; detail?: string; duplicateField?: string } {
  const code = PRISMA_CODE_MAP[err.code ?? ""] ?? "INTERNAL";
  const target: string[] | undefined = Array.isArray(err.meta?.target)
    ? (err.meta.target as string[])
    : typeof err.meta?.target === "string"
      ? [err.meta.target]
      : undefined;
  if (err.code === "P2002") {
    const first = target?.[0] ?? "value";
    return {
      code: "DUPLICATE",
      message: AppError.duplicate(first).message,
      duplicateField: first,
    };
  }
  if (err.code === "P2003") {
    return {
      code: "REFERENCE_RESTRICTED",
      message: "Cannot save: a referenced record is missing or invalid. Check any dropdown fields you selected.",
      detail: target?.[0],
    };
  }
  if (err.code === "P2014") {
    return {
      code: "REFERENCE_RESTRICTED",
      message: "Cannot modify this record: it is used by other records.",
      detail: err.meta?.relationName,
    };
  }
  if (err.code === "P2015" || err.code === "P2025") {
    return {
      code: "NOT_FOUND",
      message: "Record not found or has been deleted by another user.",
      detail: err.meta?.cause,
    };
  }
  return {
    code: "INTERNAL",
    message: "Something went wrong on our end. Please try again.",
    detail: err.message,
  };
}

export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err;
  if (typeof err === "string") {
    const trimmed = err.trim();
    if (/^FORBIDDEN\b/i.test(trimmed)) {
      const rest = trimmed.replace(/^FORBIDDEN\s*:?\s*/i, "").trim();
      return AppError.forbidden(undefined, rest ? { detail: rest } : undefined);
    }
    if (/^NOT\s+ALLOWED\b/i.test(trimmed)) {
      return AppError.forbidden();
    }
    if (/^NOT\s+AUTHENTICATED\b/i.test(trimmed)) {
      return AppError.notAuthenticated({ detail: trimmed });
    }
    if (/^ORGANIZATION\s+CONTEXT\s+IS\s+REQUIRED\b/i.test(trimmed)) {
      return AppError.orgRequired({ detail: trimmed });
    }
    if (/^RECORD\s+NOT\s+FOUND\b/i.test(trimmed)) {
      return AppError.notFound("Record", undefined, { detail: trimmed });
    }
    return AppError.validation(trimmed);
  }
  if (isPrismaError(err)) {
    const h = humanizePrisma(err);
    return new AppError({
      code: h.code,
      message: h.message,
      detail: h.detail,
      duplicateField: h.duplicateField,
      cause: err,
    });
  }
  if (err instanceof Error) {
    if (err.message && /^FORBIDDEN\b/i.test(err.message)) {
      return AppError.forbidden(undefined, { detail: err.message });
    }
    if (err.message && /^NOT\s+ALLOWED\b/i.test(err.message)) {
      return AppError.forbidden(undefined, { detail: err.message });
    }
    return new AppError({
      code: "INTERNAL",
      message: "Something went wrong on our end. Please try again.",
      detail: err.message,
      cause: err,
    });
  }
  return AppError.internal("An unexpected error occurred.", err);
}

export function toUserMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err == null) return fallback;
  const ae = toAppError(err);
  if (!ae.message) return fallback;
  return ae.message;
}

export function isNextRedirect(v: unknown): v is { digest: string } {
  return !!v && typeof v === "object" && typeof (v as any).digest === "string" && (v as any).digest.startsWith("NEXT_REDIRECT");
}

export function isNextNotFound(v: unknown): v is { digest: string } {
  return !!v && typeof v === "object" && typeof (v as any).digest === "string" && (v as any).digest.startsWith("NEXT_NOT_FOUND");
}

export function logErrorOnServer(label: string, err: unknown): void {
  if (typeof window !== "undefined") return;
  if (isNextRedirect(err) || isNextNotFound(err)) return;
  const ae = toAppError(err);
  const line = [
    `[${new Date().toISOString()}]`,
    `[${label}]`,
    `[${ae.code}]`,
    ae.message,
    ae.detail ? `detail=${JSON.stringify(ae.detail)}` : undefined,
    ae.permissionKey ? `perm=${ae.permissionKey}` : undefined,
    ae.recordType ? `record=${ae.recordType}${ae.recordId ? ":" + ae.recordId : ""}` : undefined,
    ae.cause instanceof Error ? `cause=${ae.cause.stack ?? ae.cause.message}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  console.error(line);
}
