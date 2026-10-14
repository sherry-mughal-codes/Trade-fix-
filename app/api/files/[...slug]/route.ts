import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import path from "path";
import { authOptions } from "@/lib/auth";
import { readStoredFile } from "@/lib/file-storage";

export async function GET(_: NextRequest, { params }: { params: { slug: string[] } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const relativePath = params.slug.join("/");
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");

  try {
    const file = await readStoredFile(normalized);
    return new NextResponse(file);
  } catch (error) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
