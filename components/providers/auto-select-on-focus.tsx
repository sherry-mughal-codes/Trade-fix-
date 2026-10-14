"use client";

import { useEffect } from "react";

const SELECTABLE_INPUT_TYPES = new Set([
  "text",
  "email",
  "number",
  "search",
  "tel",
  "url",
  "password",
]);

function isSelectableTarget(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(".react-select-container")) return false;

  if (target instanceof HTMLTextAreaElement) {
    return !target.disabled && !target.readOnly && target.value.length > 0;
  }

  if (target instanceof HTMLInputElement) {
    return (
      !target.disabled &&
      !target.readOnly &&
      target.value.length > 0 &&
      SELECTABLE_INPUT_TYPES.has(target.type || "text")
    );
  }

  return false;
}

export default function AutoSelectOnFocus() {
  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      if (!isSelectableTarget(event.target)) return;
      const target = event.target;

      window.requestAnimationFrame(() => {
        if (document.activeElement === target) {
          target.select();
        }
      });
    };

    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, []);

  return null;
}
