"use client";

import { useState } from "react";
import { Loader2, ArrowLeft, Calendar } from "lucide-react";
import Link from "next/link";
import { createEmployee, updateEmployee } from "../actions";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import FormLabel from "@/components/ui/form-label";
import { SearchableSingleSelect } from "@/components/ui/searchable-select";

type Employee = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  ctc: number;
  joinDate: Date;
  status: string;
};

interface EmployeeFormProps {
  initialData?: Employee | null;
}

export default function EmployeeForm({ initialData }: EmployeeFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isEditing = !!initialData;

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError(null);

    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      address: formData.get("address") as string,
      ctc: parseFloat(formData.get("ctc") as string) || 0,
      joinDate: formData.get("joinDate") as string,
      status: formData.get("status") as string,
    };

    try {
      let result;
      if (isEditing && initialData) {
        result = await updateEmployee(initialData.id, data);
      } else {
        result = await createEmployee(data);
      }

      if (result.success) {
        toast.success(
          isEditing
            ? "Employee updated successfully!"
            : "Employee created successfully!"
        );
        router.push("/hr/employees");
        router.refresh();
      } else {
        setError(result.error || "Something went wrong");
        toast.error(result.error || "Something went wrong");
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    { label: "Active", value: "ACTIVE" },
    { label: "Inactive", value: "INACTIVE" },
  ];

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/hr/employees"
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {isEditing ? "Edit Employee" : "New Employee"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditing
                ? "Update employee details"
                : "Add a new employee record"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/hr/employees"
            className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <FormLabel htmlFor="name" required>Full Name</FormLabel>
            <input
              type="text"
              id="name"
              name="name"
              required
              defaultValue={initialData?.name}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Enter full name"
            />
          </div>

          <div className="space-y-2">
            <FormLabel>Status</FormLabel>
            <SearchableSingleSelect name="status" options={statusOptions} defaultValue={initialData?.status || "ACTIVE"} isClearable={false} />
          </div>

          <div className="space-y-2">
            <FormLabel htmlFor="email">Email Address</FormLabel>
            <input
              type="email"
              id="email"
              name="email"
              defaultValue={initialData?.email || ""}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="email@example.com"
            />
          </div>

          <div className="space-y-2">
            <FormLabel htmlFor="phone">Phone Number</FormLabel>
            <input
              type="tel"
              id="phone"
              name="phone"
              defaultValue={initialData?.phone || ""}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="space-y-2">
            <FormLabel htmlFor="ctc" required>CTC Amount</FormLabel>
            <input
              type="number"
              id="ctc"
              name="ctc"
              required
              min="0"
              step="0.01"
              defaultValue={initialData?.ctc || 0}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Cost to Company (Monthly/Annual based on policy)
            </p>
          </div>

          <div className="space-y-2">
            <FormLabel htmlFor="joinDate" required>Join Date</FormLabel>
            <div className="relative">
                <input
                  type="date"
                  id="joinDate"
                  name="joinDate"
                  required
                  defaultValue={
                    initialData?.joinDate
                      ? new Date(initialData.joinDate).toISOString().split("T")[0]
                      : new Date().toISOString().split("T")[0]
                  }
                  onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                  className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <FormLabel htmlFor="address">Address</FormLabel>
            <textarea
              id="address"
              name="address"
              rows={3}
              defaultValue={initialData?.address || ""}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Enter full address"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
