import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

import { ACTIVE_ORG_COOKIE } from "@/lib/tenancy-config";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth?.token;
    const pathname = req.nextUrl.pathname;
    const isSuperadmin = Boolean(token?.isSuperadmin);
    const hasActiveOrg = Boolean(req.cookies.get(ACTIVE_ORG_COOKIE)?.value);
    const allowedSuperadminLandingPaths = new Set(["/orgs", "/profile"]);

    if (isSuperadmin && !hasActiveOrg && !allowedSuperadminLandingPaths.has(pathname)) {
      return NextResponse.redirect(new URL("/orgs", req.url));
    }

    if (isSuperadmin && hasActiveOrg && pathname === "/orgs") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/auth/login",
    },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|auth|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|xml|woff|woff2)$).*)",
  ],
};
