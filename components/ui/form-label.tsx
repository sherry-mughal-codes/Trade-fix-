"use client";

type FormLabelProps = {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
};

export default function FormLabel({ htmlFor, required = false, children, className = "" }: FormLabelProps) {
  return (
    <label htmlFor={htmlFor} className={`text-sm font-medium text-foreground ${className}`.trim()}>
      {children}
      {required ? <span className="text-red-500 ml-1">*</span> : null}
    </label>
  );
}
