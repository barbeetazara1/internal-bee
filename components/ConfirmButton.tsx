"use client";

import { confirmDialog } from "./confirm";

/** Tombol submit yang meminta konfirmasi lewat dialog kita sendiri; dipakai di dalam <form action={serverAction}>. */
export default function ConfirmButton({
  message,
  title,
  confirmLabel,
  danger,
  disabled,
  tooltip,
  className,
  children,
}: {
  message: string;
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  tooltip?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      title={tooltip}
      className={className}
      onClick={async (e) => {
        const btn = e.currentTarget;
        e.preventDefault();
        if (await confirmDialog({ title, message, confirmLabel, danger })) btn.form?.requestSubmit(btn);
      }}
    >
      {children}
    </button>
  );
}
