"use client";

import { X, Mail, Phone, MapPin, Calendar, DollarSign, Edit } from "lucide-react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { format } from "date-fns";

interface EmployeeDetailsModalProps {
  employee: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function EmployeeDetailsModal({ employee, isOpen, onClose }: EmployeeDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-accent/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-minia-primary/10 flex items-center justify-center text-minia-primary text-lg font-bold">
                {employee.name.charAt(0).toUpperCase()}
            </div>
            <div>
                <h2 className="text-lg font-semibold text-foreground">{employee.name}</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    employee.status === "ACTIVE"
                        ? "bg-minia-success/10 text-minia-success"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                }`}>
                    {employee.status}
                </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Info */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact Details</h3>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{employee.email || "N/A"}</span>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{employee.phone || "N/A"}</span>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm text-foreground">{employee.address || "N/A"}</span>
                </div>
            </div>

            {/* Job Details */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Employment Details</h3>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Joined Date</span>
                        <span className="text-sm font-medium text-foreground">
                            {format(new Date(employee.joinDate), "PPP")}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">CTC Amount</span>
                        <span className="text-sm font-bold text-foreground">
                            {employee.ctc.toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-accent/20 border-t border-border flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-md hover:bg-accent transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
