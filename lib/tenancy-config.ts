export const ACTIVE_ORG_COOKIE = "tradefix_active_org";

export const MODULE_KEYS = [
  "customers",
  "invoices",
  "payments",
  "inventory",
  "journal",
  "reports",
  "hr",
  "pos",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
