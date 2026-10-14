import { NextResponse } from "next/server";
import { getPermissionContext } from "@/lib/rbac";

export async function GET() {
  const ctx = await getPermissionContext();
  return NextResponse.json(ctx);
}

