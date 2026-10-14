"use client";

import { useState } from "react";
import Select from "react-select";

export type SearchableOption = {
  label: string;
  value: string;
};

type SearchableSelectProps = {
  name: string;
  options: SearchableOption[];
  defaultValue?: string | null;
  placeholder?: string;
  isClearable?: boolean;
  required?: boolean;
  onValueChange?: (value: string) => void;
};

type SearchableMultiSelectProps = {
  name: string;
  options: SearchableOption[];
  defaultValues?: string[];
  placeholder?: string;
};

const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: 42,
    borderColor: state.isFocused ? "hsl(var(--primary))" : "hsl(var(--input))",
    boxShadow: state.isFocused ? "0 0 0 1px hsl(var(--primary))" : "none",
    backgroundColor: "hsl(var(--background))",
    "&:hover": {
      borderColor: "hsl(var(--primary))",
    },
  }),
  menu: (base: any) => ({
    ...base,
    zIndex: 50,
    backgroundColor: "hsl(var(--popover))",
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isFocused ? "hsl(var(--accent))" : "hsl(var(--popover))",
    color: "hsl(var(--foreground))",
  }),
  singleValue: (base: any) => ({
    ...base,
    color: "hsl(var(--foreground))",
  }),
  input: (base: any) => ({
    ...base,
    color: "hsl(var(--foreground))",
  }),
  placeholder: (base: any) => ({
    ...base,
    color: "hsl(var(--muted-foreground))",
  }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: "hsl(var(--accent))",
  }),
  multiValueLabel: (base: any) => ({
    ...base,
    color: "hsl(var(--foreground))",
  }),
};

export function SearchableSelect({
  name,
  options,
  defaultValue = null,
  placeholder = "Select...",
  isClearable = true,
}: SearchableSelectProps) {
  const selected = options.find((option) => option.value === defaultValue) || null;

  return (
    <div className="space-y-2">
      <Select
        inputId={name}
        name={`${name}__display`}
        options={options}
        defaultValue={selected}
        isClearable={isClearable}
        placeholder={placeholder}
        styles={selectStyles}
        classNamePrefix="taxfix-select"
      />
      <input type="hidden" name={name} defaultValue={defaultValue || ""} />
    </div>
  );
}

export function SearchableSingleSelect({
  name,
  options,
  defaultValue = null,
  placeholder = "Select...",
  isClearable = true,
  onValueChange,
}: SearchableSelectProps) {
  const selected = options.find((option) => option.value === defaultValue) || null;
  return (
    <SelectWithHiddenInput
      name={name}
      options={options}
      selected={selected}
      placeholder={placeholder}
      isClearable={isClearable}
      onValueChange={onValueChange}
    />
  );
}

function SelectWithHiddenInput({
  name,
  options,
  selected,
  placeholder,
  isClearable,
  onValueChange,
}: {
  name: string;
  options: SearchableOption[];
  selected: SearchableOption | null;
  placeholder: string;
  isClearable: boolean;
  onValueChange?: (value: string) => void;
}) {
  return (
    <SelectField name={name} options={options} defaultSelected={selected} placeholder={placeholder} isClearable={isClearable} onValueChange={onValueChange} />
  );
}

function SelectField({
  name,
  options,
  defaultSelected,
  placeholder,
  isClearable,
  onValueChange,
}: {
  name: string;
  options: SearchableOption[];
  defaultSelected: SearchableOption | null;
  placeholder: string;
  isClearable: boolean;
  onValueChange?: (value: string) => void;
}) {
  const [selected, setSelected] = useState<SearchableOption | null>(defaultSelected);
  return (
    <div className="space-y-2">
      <Select
        inputId={name}
        options={options}
        value={selected}
        onChange={(option: any) => {
          const nextValue = (option as SearchableOption | null) || null;
          setSelected(nextValue);
          onValueChange?.(nextValue?.value || "");
        }}
        isClearable={isClearable}
        placeholder={placeholder}
        styles={selectStyles}
        classNamePrefix="taxfix-select"
      />
      <input type="hidden" name={name} value={selected?.value || ""} readOnly />
    </div>
  );
}

export function SearchableMultiSelect({
  name,
  options,
  defaultValues = [],
  placeholder = "Select...",
}: SearchableMultiSelectProps) {
  const initialSelected = options.filter((option) => defaultValues.includes(option.value));
  const [selected, setSelected] = useState<SearchableOption[]>(initialSelected);

  return (
    <div className="space-y-2">
      <Select
        inputId={name}
        isMulti
        options={options}
        value={selected}
        onChange={(value) => setSelected((value as SearchableOption[]) || [])}
        placeholder={placeholder}
        styles={selectStyles}
        classNamePrefix="taxfix-select"
      />
      {selected.map((option) => (
        <input key={option.value} type="hidden" name={name} value={option.value} readOnly />
      ))}
    </div>
  );
}
