"use client";

import { useEffect } from "react";

const FAVICON_ID = "tradefix-dynamic-favicon";

function upsertFavicon(href: string) {
  const head = document.head;
  if (!head) return;

  let icon = document.getElementById(FAVICON_ID) as HTMLLinkElement | null;

  if (!icon) {
    icon = document.createElement("link");
    icon.id = FAVICON_ID;
    icon.rel = "icon";
    head.appendChild(icon);
  }

  icon.href = href;
}

export default function FaviconSync() {
  useEffect(() => {
    upsertFavicon("/icon.png");
  }, []);

  return null;
}
