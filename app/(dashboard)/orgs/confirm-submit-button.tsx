"use client";

import { useRef, useState } from "react";

import ConfirmDialog from "@/components/ui/confirm-dialog";

type ConfirmSubmitButtonProps = {
  label: string;
  confirmMessage: string;
  className?: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
};

export default function ConfirmSubmitButton({
  label,
  confirmMessage,
  className,
  title,
  confirmText,
  cancelText,
  type = "warning",
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={(event) => {
          const form = (event.currentTarget as HTMLButtonElement).closest("form");
          if (!form) return;
          formRef.current = form;
          setOpen(true);
        }}
      >
        {label}
      </button>

      <ConfirmDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          formRef.current?.requestSubmit();
        }}
        title={title || "Confirm"}
        message={confirmMessage}
        confirmText={confirmText || label}
        cancelText={cancelText || "Cancel"}
        type={type}
      />
    </>
  );
}
