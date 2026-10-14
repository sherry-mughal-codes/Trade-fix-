import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireOrganizationContext } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const organizationId = (await requireOrganizationContext()).activeOrganizationId;
    if (!organizationId) {
      return NextResponse.json({ companyName: null, logoUrl: null });
    }

    const settings = await prisma.companySettings.findFirst({
      where: { organizationId },
      select: {
        companyName: true,
        logoUrl: true,
        lightLogoUrl: true,
        iconUrl: true,
        darkIconUrl: true,
      },
    });

    return NextResponse.json({
      companyName: settings?.companyName || null,
      logoUrl: settings?.logoUrl || null,
      lightLogoUrl: settings?.lightLogoUrl || null,
      iconUrl: settings?.iconUrl || null,
      darkIconUrl: settings?.darkIconUrl || null,
    });
  } catch {
    return NextResponse.json(
      { companyName: null, logoUrl: null, lightLogoUrl: null, iconUrl: null, darkIconUrl: null },
      { status: 200 },
    );
  }
}
