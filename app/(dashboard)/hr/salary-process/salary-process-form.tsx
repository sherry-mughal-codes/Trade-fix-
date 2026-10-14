"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { getEmployees, getHRSettings, processSalaryBatch, getProcessedSalaries } from "../actions";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

type Employee = {
  id: string;
  name: string;
  ctc: number;
};

type SalaryRow = {
  employeeId: string;
  name: string;
  ctc: number;
  absentDays: number;
  bonus: number;
  deduction: number;
  payable: number;
  finalPayable: number;
};

export default function SalaryProcessForm() {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([]);
  const [settings, setSettings] = useState<{ salaryDivisionDays: number } | null>(null);
  
  const [month, setMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [year, setYear] = useState(new Date().getFullYear());
  
  const router = useRouter();

  const lastDayOfMonth = new Date(year, month, 0);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDayMidnight = new Date(lastDayOfMonth.getFullYear(), lastDayOfMonth.getMonth(), lastDayOfMonth.getDate());
  const isMonthCompleted = todayMidnight >= lastDayMidnight;
  const lastDayFormatted = lastDayOfMonth.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [empResult, settingsResult, processedSalariesResult] = await Promise.all([
        getEmployees(),
        getHRSettings(),
        getProcessedSalaries(month, year)
      ]);

      if (settingsResult.success && settingsResult.data) {
        setSettings({ salaryDivisionDays: settingsResult.data.salaryDivisionDays || 30 });
      }

      if (empResult.success && empResult.data) {
        const activeEmps = (empResult.data as any[]).filter(e => {
            // Check status
            if (e.status !== 'ACTIVE') return false;

            // Check joining date vs selected month
            // We want to exclude employees who joined AFTER the selected month
            if (e.joinDate) {
                const joinDate = new Date(e.joinDate);
                // Last day of the selected month
                const endOfSelectedMonth = new Date(year, month, 0); 
                
                // If join date is after the end of the selected month, exclude
                if (joinDate > endOfSelectedMonth) return false;
            }
            return true;
        });
        setEmployees(activeEmps);
        
        const processedEmployeeIds = new Set(
            (processedSalariesResult.success && processedSalariesResult.data) 
            ? (processedSalariesResult.data as any[]).map(s => s.employeeId) 
            : []
        );

        const empsToProcess = activeEmps.filter(emp => !processedEmployeeIds.has(emp.id));

        const initialRows = empsToProcess.map(emp => ({
          employeeId: emp.id,
          name: emp.name,
          ctc: emp.ctc,
          absentDays: 0,
          bonus: 0,
          deduction: 0,
          payable: emp.ctc, // Default full salary
          finalPayable: emp.ctc,
        }));
        setSalaryRows(initialRows);
      }
      setLoading(false);
    };
    loadData();
  }, [month, year]);

  const handleInputChange = (index: number, field: keyof SalaryRow, value: number) => {
    const newRows = [...salaryRows];
    const row = newRows[index];
    const divisionDays = settings?.salaryDivisionDays || 30;

    // Update field
    (row as any)[field] = value;

    // Recalculate Payable
    if (field === 'absentDays' || field === 'ctc') {
      const perDay = row.ctc / divisionDays;
      const payableDays = Math.max(0, divisionDays - row.absentDays);
      row.payable = Math.round(perDay * payableDays * 100) / 100;
    }

    // Recalculate Final Payable
    if (field !== 'finalPayable') {
        row.finalPayable = Math.round((row.payable + row.bonus - row.deduction) * 100) / 100;
    }

    setSalaryRows(newRows);
  };

  const handleSubmit = async () => {
    if (!isMonthCompleted) {
      toast.error(`Salary for this month can only be processed on or after the last date of the month (${lastDayFormatted}).`);
      return;
    }
    setProcessing(true);
    
    const slips = salaryRows.map(row => ({
      employeeId: row.employeeId,
      ctcAmount: row.ctc,
      absentDays: row.absentDays,
      bonus: row.bonus,
      deduction: row.deduction,
      payableAmount: row.payable,
      finalPayableAmount: row.finalPayable,
    }));

    const result = await processSalaryBatch(month, year, slips);

    if (result.success) {
      toast.success("Salary processed successfully!");
      setSalaryRows([]);
      router.push("/hr/salary-process");
      router.refresh();
    } else {
      // Handle the specific error about default accounts
      if (result.error && result.error.includes("configure default HR accounts")) {
        toast.error("Default Salary Payable Account should be selected in Company Settings first.", {
            duration: 5000,
            style: {
                minWidth: '400px'
            }
        });
      } else {
        toast.error(result.error || "Failed to process salary");
      }
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="flex gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Month</label>
            <select 
              value={month} 
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-input bg-background rounded-md"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Year</label>
            <input 
              type="number" 
              value={year} 
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-input bg-background rounded-md"
            />
          </div>
        </div>

        {!isMonthCompleted && (
          <div className="flex items-center gap-2.5 p-3.5 mb-6 text-sm text-amber-900 dark:text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Salary for this month can only be processed on or after the last date of the month (<strong>{lastDayFormatted}</strong>).
            </span>
          </div>
        )}

        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Employee</th>
                <th className="px-4 py-3 text-right font-medium">CTC</th>
                <th className="px-4 py-3 text-right font-medium">Absent Days</th>
                <th className="px-4 py-3 text-right font-medium">Payable</th>
                <th className="px-4 py-3 text-right font-medium">Bonus</th>
                <th className="px-4 py-3 text-right font-medium">Deduction</th>
                <th className="px-4 py-3 text-right font-medium">Final Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {salaryRows.map((row, index) => (
                <tr key={row.employeeId}>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-right">{row.ctc.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={row.absentDays}
                      onChange={(e) => handleInputChange(index, "absentDays", parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-right border rounded bg-background"
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{row.payable.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min="0"
                      value={row.bonus}
                      onChange={(e) => handleInputChange(index, "bonus", parseFloat(e.target.value) || 0)}
                      className="w-24 px-2 py-1 text-right border rounded bg-background"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min="0"
                      value={row.deduction}
                      onChange={(e) => handleInputChange(index, "deduction", parseFloat(e.target.value) || 0)}
                      className="w-24 px-2 py-1 text-right border rounded bg-background"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-primary">
                     <input
                      type="number"
                      min="0"
                      value={row.finalPayable}
                      onChange={(e) => handleInputChange(index, "finalPayable", parseFloat(e.target.value) || 0)}
                      className="w-28 px-2 py-1 text-right border rounded bg-background font-bold"
                    />
                  </td>
                </tr>
              ))}
              {salaryRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    {employees.length > 0 
                        ? "All active employees have already been processed for this month."
                        : "No active employees found to process."
                    }
                  </td>
                </tr>
              )}
            </tbody>
            {salaryRows.length > 0 && (
                <tfoot className="bg-muted/50 font-medium">
                    <tr>
                        <td colSpan={6} className="px-4 py-3 text-right">Total Payable:</td>
                        <td className="px-4 py-3 text-right">
                            {salaryRows.reduce((sum, row) => sum + row.finalPayable, 0).toLocaleString()}
                        </td>
                    </tr>
                </tfoot>
            )}
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={processing || salaryRows.length === 0 || !isMonthCompleted}
            className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Process Salary
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
