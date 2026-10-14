"use server";

import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

export async function changeMyPassword(currentPassword: string, newPassword: string) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { error: "Not authenticated" };

  const current = currentPassword || "";
  const next = newPassword || "";
  if (!current) return { error: "Current password is required" };
  if (!next || next.length < 6) return { error: "Password must be at least 6 characters" };

  try {
    const user = await prismaAny.user.findUnique({
      where: { id: userId },
      select: { password: true, isActive: true },
    });

    if (!user?.isActive) return { error: "Not allowed" };

    const ok = await bcrypt.compare(current, user.password || "");
    if (!ok) return { error: "Current password is incorrect" };

    const hashed = await bcrypt.hash(next, 10);
    await prismaAny.user.update({ where: { id: userId }, data: { password: hashed } });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to change password" };
  }

  revalidatePath("/profile");
  return { success: true };
}

