"use client";

import { useState } from "react";
import { updateCompanySettings } from "./actions";
import { createCurrency } from "../data-settings/actions";
import { Loader2, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePermissions } from "@/lib/use-permissions";

type Settings = {
  id: string;
  companyName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  baseCurrency: string;
  dateFormat: string;
  logoUrl: string | null;
  lightLogoUrl: string | null;
  invoicePrefix: string;
  invoiceStartNumber: number;
  invoiceCurrentNumber: number;
  purchaseInvoicePrefix: string;
  purchaseInvoiceStartNumber: number;
  purchaseInvoiceCurrentNumber: number;
  journalPrefix: string;
  journalStartNumber: number;
  journalCurrentNumber: number;
  paymentPrefix: string;
  paymentStartNumber: number;
  paymentCurrentNumber: number;
  invoiceTerms: string | null;
  allowNegativeStock: boolean;
  defaultSalesAccount: string | null;
  defaultPurchaseAccount: string | null;
  defaultReceivableAccount: string | null;
  defaultPayableAccount: string | null;
  defaultInventoryAssetAccount: string | null;
  defaultCogsAccount: string | null;
  defaultStockAdjustmentGainAccount: string | null;
  defaultStockAdjustmentLossAccount: string | null;
  defaultOpeningStockAccount: string | null;
  defaultCashGroupAccount: string | null;
  defaultBankGroupAccount: string | null;
  defaultExpenseGroupAccount: string | null;
  salaryDivisionDays: number;
  defaultSalaryExpenseAccount: string | null;
  defaultSalaryPayableAccount: string | null;
  createdAt: string;
  updatedAt: string;
};

type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
};

type Account = {
  id: string;
  name: string;
  code: string | null;
  type: string;
  isGroup: boolean;
};

export default function SettingsForm({ initialSettings, currencies: initialCurrencies, accounts }: { initialSettings: Settings | null, currencies: Currency[], accounts: Account[] }) {
  const { has, isSuperadmin, loading: permissionsLoading } = usePermissions();
  const canUpdateCompany = has("settings.company.update");
  const canManageData = has("settings.data.access");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockRestricted = loading || permissionsLoading || !canUpdateCompany || !isSuperadmin;
  const lockAllowed = loading || permissionsLoading || !canUpdateCompany;
  
  // Logo Upload State
  const [logoPreview, setLogoPreview] = useState<string | null>(initialSettings?.logoUrl || null);
  const [lightLogoPreview, setLightLogoPreview] = useState<string | null>(initialSettings?.lightLogoUrl || null);
  
  // Currency State
  const [currencies, setCurrencies] = useState<Currency[]>(initialCurrencies);
  const [showNewCurrency, setShowNewCurrency] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(initialSettings?.baseCurrency || "USD");
  
  // New Currency State
  const [newCurrencyCode, setNewCurrencyCode] = useState("");
  const [newCurrencyName, setNewCurrencyName] = useState("");
  const [newCurrencySymbol, setNewCurrencySymbol] = useState("");
  const [currencyLoading, setCurrencyLoading] = useState(false);

  const getAccountSelectValue = (value: string | null | undefined) =>
    accounts.find((account) => account.id === value || account.name === value)?.id || "";

  const handleCreateCurrency = async () => {
    if (permissionsLoading || !canManageData) {
      toast.error("Not allowed");
      return;
    }
    if (!newCurrencyCode || !newCurrencyName) return;
    
    setCurrencyLoading(true);
    const result = await createCurrency({
      code: newCurrencyCode,
      name: newCurrencyName,
      symbol: newCurrencySymbol,
    });
    setCurrencyLoading(false);

    if (result.success) {
      const newCurrency = {
        id: crypto.randomUUID(),
        code: newCurrencyCode,
        name: newCurrencyName,
        symbol: newCurrencySymbol || null,
      };
      const updatedCurrencies = [...currencies, newCurrency].sort((a, b) => a.code.localeCompare(b.code));
      setCurrencies(updatedCurrencies);
      setSelectedCurrency(newCurrency.code);
      setShowNewCurrency(false);
      setNewCurrencyCode("");
      setNewCurrencyName("");
      setNewCurrencySymbol("");
      toast.success("Currency added successfully!");
    } else {
      toast.error(result.error || "Failed to create currency");
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            toast.error("Image size must be less than 2MB");
            return;
        }
        
        // Create a preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setLogoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleLightLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            toast.error("Image size must be less than 2MB");
            return;
        }
        
        // Create a preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setLightLogoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (permissionsLoading || !canUpdateCompany) {
      toast.error("Not allowed");
      return;
    }
    setLoading(true);
    setSuccess(false);
    setError(null);

    const formData = new FormData(e.currentTarget);
    
    // If we have a logo preview (base64) and it's different from initial, we might want to handle it.
    // However, for now we will rely on the server action to handle the file upload or base64 string.
    // Since we don't have a robust file upload service (S3 etc) setup yet, we might need to store as base64 or save to public folder.
    // For simplicity in this demo, let's assume we are sending the file object and the server will handle it, 
    // OR we convert to base64 and send as string if the server expects a string URL.
    
    // Given the constraints and current setup (Next.js server actions), sending large base64 strings in formData works but isn't ideal for large files.
    // Let's try to append the base64 string to a hidden input if it changed, or just let the file input be sent.
    
    // Actually, looking at the previous implementation details, we might need a way to upload.
    // But since the user asked to "add an option to upload the logo", let's enable the file input.
    
    // We will convert the file to base64 string here and send it as 'logoUrl' for simplicity, 
    // effectively storing the image data directly in the database (text/blob) or just using it for display if the backend supports it.
    // WARNING: Storing base64 in DB is not best practice for large images, but acceptable for small logos in a prototype.
    
    if (logoPreview && logoPreview !== initialSettings?.logoUrl) {
        formData.set("logoUrl", logoPreview);
    }

    if (lightLogoPreview && lightLogoPreview !== initialSettings?.lightLogoUrl) {
        formData.set("lightLogoUrl", lightLogoPreview);
    }

    // Ensure the selected currency is used if it's not in the form data correctly (though select name="baseCurrency" should handle it)
    if (selectedCurrency) {
        formData.set("baseCurrency", selectedCurrency);
    }
    
    // Ensure invoiceTerms is handled correctly (empty string becomes null in backend if we want, or just empty string)
    // The server action handles empty string/null conversion if needed.
    
    const result = await updateCompanySettings(formData);

    if (result.success) {
      setSuccess(true);
      toast.success("Settings saved successfully!");
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || "Something went wrong");
      toast.error(result.error || "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!permissionsLoading && canUpdateCompany && !isSuperadmin ? (
        <div className="bg-accent text-muted-foreground text-sm p-3 rounded-md border border-border">
          You can update company profile, branding, and invoice terms here.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="companyName" className="text-sm font-medium text-foreground">
            Company Name <span className="text-minia-danger">*</span>
          </label>
          <input
            type="text"
            id="companyName"
            name="companyName"
            required
            disabled={lockAllowed}
            defaultValue={initialSettings?.companyName || ""}
            className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            placeholder="Enter company name"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            disabled={lockAllowed}
            defaultValue={initialSettings?.email || ""}
            className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            placeholder="company@example.com"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium text-foreground">
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            disabled={lockAllowed}
            defaultValue={initialSettings?.phone || ""}
            className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            placeholder="+1 (555) 000-0000"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="taxId" className="text-sm font-medium text-foreground">
            Tax ID / VAT Number
          </label>
          <input
            type="text"
            id="taxId"
            name="taxId"
            disabled={lockAllowed}
            defaultValue={initialSettings?.taxId || ""}
            className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            placeholder="Enter Tax ID"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="address" className="text-sm font-medium text-foreground">
            Address
          </label>
          <textarea
            id="address"
            name="address"
            rows={3}
            disabled={lockAllowed}
            defaultValue={initialSettings?.address || ""}
            className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            placeholder="Enter full address"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label htmlFor="baseCurrency" className="text-sm font-medium text-foreground">
              Base Currency
            </label>
            <button 
                type="button" 
                onClick={() => setShowNewCurrency(!showNewCurrency)}
                disabled={permissionsLoading || !canManageData}
                className="text-xs text-minia-primary hover:underline flex items-center"
            >
                <Plus className="h-3 w-3 mr-1" />
                Add New
            </button>
          </div>
          
          {showNewCurrency ? (
            <div className="p-3 border border-minia-primary/20 bg-minia-primary/5 rounded-md space-y-3">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Code (e.g. USD)" 
                        className="w-1/3 px-2 py-1 text-sm bg-background border border-input rounded text-foreground"
                        value={newCurrencyCode}
                        onChange={(e) => setNewCurrencyCode(e.target.value.toUpperCase())}
                        maxLength={3}
                    />
                    <input 
                        type="text" 
                        placeholder="Name (e.g. US Dollar)" 
                        className="w-2/3 px-2 py-1 text-sm bg-background border border-input rounded text-foreground"
                        value={newCurrencyName}
                        onChange={(e) => setNewCurrencyName(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Symbol (e.g. $)" 
                        className="w-1/3 px-2 py-1 text-sm bg-background border border-input rounded text-foreground"
                        value={newCurrencySymbol}
                        onChange={(e) => setNewCurrencySymbol(e.target.value)}
                    />
                    <button 
                        type="button"
                        onClick={() => setShowNewCurrency(false)}
                        className="px-3 py-1 bg-accent text-muted-foreground text-sm rounded hover:bg-accent/80"
                    >
                        Cancel
                    </button>
                    <button 
                        type="button"
                        onClick={handleCreateCurrency}
                        disabled={currencyLoading || permissionsLoading || !canManageData || !newCurrencyCode || !newCurrencyName}
                        className="flex-1 bg-minia-primary text-primary-foreground text-sm rounded hover:bg-minia-primary/90 disabled:opacity-50"
                    >
                        {currencyLoading ? "Adding..." : "Add Currency"}
                    </button>
                </div>
            </div>
          ) : (
            <select
                id="baseCurrency"
                name="baseCurrency"
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                disabled={lockAllowed}
                className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
                {currencies.map((currency) => (
                    <option key={currency.id} value={currency.code}>
                        {currency.code} - {currency.name} ({currency.symbol})
                    </option>
                ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="dateFormat" className="text-sm font-medium text-foreground">
            Date Format
          </label>
          <select
            id="dateFormat"
            name="dateFormat"
            disabled={lockAllowed}
            defaultValue={initialSettings?.dateFormat || "YYYY-MM-DD"}
            className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
          >
            <option value="YYYY-MM-DD">YYYY-MM-DD (2024-03-21)</option>
            <option value="DD-MM-YYYY">DD-MM-YYYY (21-03-2024)</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY (03/21/2024)</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY (21/03/2024)</option>
          </select>
        </div>
        
        {/* Logo Upload */}
        <div className="space-y-2 md:col-span-2">
            <label htmlFor="logo" className="text-sm font-medium text-foreground block">
                Company Logo
            </label>
            <div className="flex items-center gap-6">
                <div className="relative h-20 w-20 rounded-lg border-2 border-dashed border-input flex items-center justify-center bg-accent overflow-hidden group hover:border-minia-primary transition-colors">
                    {logoPreview ? (
                        <img 
                            src={logoPreview} 
                            alt="Logo Preview" 
                            className="h-full w-full object-contain p-1"
                        />
                    ) : (
                        <div className="text-center p-2">
                            <span className="text-xs text-muted-foreground">No Logo</span>
                        </div>
                    )}
                </div>
                
                <div className="flex-1">
                    <input
                        type="file"
                        id="logo"
                        name="logo" // This won't be used directly if we set logoUrl manually
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleLogoChange}
                        disabled={lockAllowed}
                        className="block w-full text-sm text-muted-foreground
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-md file:border-0
                            file:text-sm file:font-semibold
                            file:bg-minia-primary/10 file:text-minia-primary
                            hover:file:bg-minia-primary/20
                            cursor-pointer"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                        SVG, PNG, JPG or GIF (max. 2MB). This logo will appear on your invoices and top navbar.
                    </p>
                </div>
            </div>
            {/* Hidden field to store the base64 string or URL */}
            <input type="hidden" name="logoUrl" value={logoPreview || ""} />
        </div>

        {/* Light Logo Upload (For Dark Mode) */}
        <div className="space-y-2 md:col-span-2">
            <label htmlFor="lightLogo" className="text-sm font-medium text-foreground block">
                Light Company Logo (For Dark Mode)
            </label>
            <div className="flex items-center gap-6">
                <div className="relative h-20 w-20 rounded-lg border-2 border-dashed border-input flex items-center justify-center bg-gray-900 overflow-hidden group hover:border-minia-primary transition-colors">
                    {lightLogoPreview ? (
                        <img 
                            src={lightLogoPreview} 
                            alt="Light Logo Preview" 
                            className="h-full w-full object-contain p-1"
                        />
                    ) : (
                        <div className="text-center p-2">
                            <span className="text-xs text-muted-foreground">No Logo</span>
                        </div>
                    )}
                </div>
                
                <div className="flex-1">
                    <input
                        type="file"
                        id="lightLogo"
                        name="lightLogo"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleLightLogoChange}
                        disabled={lockAllowed}
                        className="block w-full text-sm text-muted-foreground
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-md file:border-0
                            file:text-sm file:font-semibold
                            file:bg-minia-primary/10 file:text-minia-primary
                            hover:file:bg-minia-primary/20
                            cursor-pointer"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                        SVG, PNG, JPG or GIF (max. 2MB). This logo will appear on your sidebar when in dark mode.
                    </p>
                </div>
            </div>
            {/* Hidden field to store the base64 string or URL */}
            <input type="hidden" name="lightLogoUrl" value={lightLogoPreview || ""} />
        </div>

      </div>

      <div className="pt-6 border-t border-border">
        <h2 className="text-lg font-medium text-foreground mb-4">Series Settings</h2>
        
        <div className="space-y-6">
          {/* Invoice Series */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Invoice Series</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label htmlFor="invoicePrefix" className="text-sm font-medium text-foreground">
                  Prefix
                </label>
                <input
                  type="text"
                  id="invoicePrefix"
                  name="invoicePrefix"
                  disabled={lockRestricted}
                  defaultValue={initialSettings?.invoicePrefix ?? "INV-"}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                  placeholder="INV-"
                />
                <p className="text-xs text-muted-foreground">e.g., INV-</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="invoiceStartNumber" className="text-sm font-medium text-foreground">
                  Start Number
                </label>
                <input
                  type="number"
                  id="invoiceStartNumber"
                  name="invoiceStartNumber"
                  min="1"
                  disabled={lockRestricted}
                  defaultValue={initialSettings?.invoiceStartNumber || 1}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                />
                <p className="text-xs text-muted-foreground">Starting number</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="invoiceCurrentNumber" className="text-sm font-medium text-foreground">
                  Current Number
                </label>
                <input
                  type="number"
                  id="invoiceCurrentNumber"
                  name="invoiceCurrentNumber"
                  min="1"
                  disabled={lockRestricted}
                  defaultValue={initialSettings?.invoiceCurrentNumber || 1}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                />
                <p className="text-xs text-muted-foreground">Next number</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Purchase Invoice Series</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label htmlFor="purchaseInvoicePrefix" className="text-sm font-medium text-foreground">
                  Prefix
                </label>
                <input
                  type="text"
                  id="purchaseInvoicePrefix"
                  name="purchaseInvoicePrefix"
                  disabled={lockRestricted}
                  defaultValue={initialSettings?.purchaseInvoicePrefix ?? "PINV-"}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                  placeholder="PINV-"
                />
                <p className="text-xs text-muted-foreground">e.g., PINV-</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="purchaseInvoiceStartNumber" className="text-sm font-medium text-foreground">
                  Start Number
                </label>
                <input
                  type="number"
                  id="purchaseInvoiceStartNumber"
                  name="purchaseInvoiceStartNumber"
                  min="1"
                  disabled={lockRestricted}
                  defaultValue={initialSettings?.purchaseInvoiceStartNumber || 1}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                />
                <p className="text-xs text-muted-foreground">Starting number</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="purchaseInvoiceCurrentNumber" className="text-sm font-medium text-foreground">
                  Current Number
                </label>
                <input
                  type="number"
                  id="purchaseInvoiceCurrentNumber"
                  name="purchaseInvoiceCurrentNumber"
                  min="1"
                  disabled={lockRestricted}
                  defaultValue={initialSettings?.purchaseInvoiceCurrentNumber || 1}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                />
                <p className="text-xs text-muted-foreground">Next number</p>
              </div>
            </div>
          </div>

          {/* Journal Series */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Journal Entry Series</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label htmlFor="journalPrefix" className="text-sm font-medium text-foreground">
                  Prefix
                </label>
                <input
                  type="text"
                  id="journalPrefix"
                  name="journalPrefix"
                  disabled={lockRestricted}
                  defaultValue={initialSettings?.journalPrefix ?? "JRN-"}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                  placeholder="JRN-"
                />
                <p className="text-xs text-muted-foreground">e.g., JRN-</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="journalStartNumber" className="text-sm font-medium text-foreground">
                  Start Number
                </label>
                <input
                  type="number"
                  id="journalStartNumber"
                  name="journalStartNumber"
                  min="1"
                  disabled={lockRestricted}
                  defaultValue={initialSettings?.journalStartNumber || 1}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                />
                <p className="text-xs text-muted-foreground">Starting number</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="journalCurrentNumber" className="text-sm font-medium text-foreground">
                  Current Number
                </label>
                <input
                  type="number"
                  id="journalCurrentNumber"
                  name="journalCurrentNumber"
                  min="1"
                  disabled={lockRestricted}
                  defaultValue={initialSettings?.journalCurrentNumber || 1}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                />
                <p className="text-xs text-muted-foreground">Next number</p>
              </div>
            </div>
          </div>

          {/* Payment Series */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Payment Series</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label htmlFor="paymentPrefix" className="text-sm font-medium text-foreground">
                  Prefix
                </label>
                <input
                  type="text"
                  id="paymentPrefix"
                  name="paymentPrefix"
                  disabled={lockRestricted}
                  defaultValue={initialSettings?.paymentPrefix ?? "PAY-"}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                  placeholder="PAY-"
                />
                <p className="text-xs text-muted-foreground">e.g., PAY-</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="paymentStartNumber" className="text-sm font-medium text-foreground">
                  Start Number
                </label>
                <input
                  type="number"
                  id="paymentStartNumber"
                  name="paymentStartNumber"
                  min="1"
                  disabled={lockRestricted}
                  defaultValue={initialSettings?.paymentStartNumber || 1}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                />
                <p className="text-xs text-muted-foreground">Starting number</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="paymentCurrentNumber" className="text-sm font-medium text-foreground">
                  Current Number
                </label>
                <input
                  type="number"
                  id="paymentCurrentNumber"
                  name="paymentCurrentNumber"
                  min="1"
                  disabled={lockRestricted}
                  defaultValue={initialSettings?.paymentCurrentNumber || 1}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
                />
                <p className="text-xs text-muted-foreground">Next number</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-border">
        <h2 className="text-lg font-medium text-foreground mb-4">Sales Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2 md:col-span-3">
            <label htmlFor="invoiceTerms" className="text-sm font-medium text-foreground">
              Invoice Terms & Conditions
            </label>
            <textarea
              id="invoiceTerms"
              name="invoiceTerms"
              rows={4}
              disabled={lockAllowed}
              defaultValue={initialSettings?.invoiceTerms || ""}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
              placeholder="Enter default terms and conditions for sales invoices..."
            />
            <p className="text-xs text-muted-foreground">These terms will appear on all new sales invoices by default.</p>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-border">
        <h2 className="text-lg font-medium text-foreground mb-4">Accounts Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="defaultSalesAccount" className="text-sm font-medium text-foreground">
              Default Sales Account
            </label>
            <select
              id="defaultSalesAccount"
              name="defaultSalesAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultSalesAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}{account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Default account for sales income</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultPurchaseAccount" className="text-sm font-medium text-foreground">
              Default Purchase Account
            </label>
            <select
              id="defaultPurchaseAccount"
              name="defaultPurchaseAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultPurchaseAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}{account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Default account for purchase invoices and non-inventory purchases</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultReceivableAccount" className="text-sm font-medium text-foreground">
              Default Receivable Account
            </label>
            <select
              id="defaultReceivableAccount"
              name="defaultReceivableAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultReceivableAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}{account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Default account for accounts receivable</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultPayableAccount" className="text-sm font-medium text-foreground">
              Default Payable Account
            </label>
            <select
              id="defaultPayableAccount"
              name="defaultPayableAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultPayableAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}{account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Default account for accounts payable</p>
          </div>

          <div className="space-y-2">
          <label htmlFor="allowNegativeStock" className="text-sm font-medium text-foreground">
            Negative Stock Policy
          </label>
          <label className="flex items-start gap-3 rounded-md border border-input bg-background px-3 py-3">
            <input
              type="checkbox"
              id="allowNegativeStock"
              name="allowNegativeStock"
              disabled={lockAllowed}
              defaultChecked={Boolean(initialSettings?.allowNegativeStock)}
              className="mt-1 h-4 w-4 rounded border-input text-minia-primary focus:ring-minia-primary"
            />
            <div>
              <p className="text-sm font-medium text-foreground">Allow negative stock</p>
              <p className="text-xs text-muted-foreground">
                When enabled, sales and stock-out transactions can post even when available stock goes below zero.
              </p>
            </div>
          </label>
        </div>

        <div className="space-y-2">
            <label htmlFor="defaultInventoryAssetAccount" className="text-sm font-medium text-foreground">
              Default Inventory Asset Account
            </label>
            <select
              id="defaultInventoryAssetAccount"
              name="defaultInventoryAssetAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultInventoryAssetAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}{account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Default asset account for inventory value on hand</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultCogsAccount" className="text-sm font-medium text-foreground">
              Default COGS Account
            </label>
            <select
              id="defaultCogsAccount"
              name="defaultCogsAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultCogsAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}{account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Default cost of goods sold account for inventory sales</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultStockAdjustmentGainAccount" className="text-sm font-medium text-foreground">
              Default Stock Gain Account
            </label>
            <select
              id="defaultStockAdjustmentGainAccount"
              name="defaultStockAdjustmentGainAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultStockAdjustmentGainAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}{account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Default account for positive stock adjustments</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultStockAdjustmentLossAccount" className="text-sm font-medium text-foreground">
              Default Stock Loss Account
            </label>
            <select
              id="defaultStockAdjustmentLossAccount"
              name="defaultStockAdjustmentLossAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultStockAdjustmentLossAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}{account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Default account for negative stock adjustments</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultOpeningStockAccount" className="text-sm font-medium text-foreground">
              Default Opening Stock Account
            </label>
            <select
              id="defaultOpeningStockAccount"
              name="defaultOpeningStockAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultOpeningStockAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}{account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Default offset account for opening stock entries</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultCashGroupAccount" className="text-sm font-medium text-foreground">
              Default Cash Group Account
            </label>
            <select
              id="defaultCashGroupAccount"
              name="defaultCashGroupAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultCashGroupAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Group Account</option>
              {accounts.filter(acc => acc.isGroup).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}{account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Parent group for all cash accounts (e.g. 1000)</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultBankGroupAccount" className="text-sm font-medium text-foreground">
              Default Bank Group Account
            </label>
            <select
              id="defaultBankGroupAccount"
              name="defaultBankGroupAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultBankGroupAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Group Account</option>
              {accounts.filter(acc => acc.isGroup).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}{account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Parent group for all bank accounts (e.g. 1050)</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultExpenseGroupAccount" className="text-sm font-medium text-foreground">
              Default Expense Group Account
            </label>
            <select
              id="defaultExpenseGroupAccount"
              name="defaultExpenseGroupAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultExpenseGroupAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Group Account</option>
              {accounts
                .filter((acc) => acc.isGroup && acc.type === "EXPENSE")
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code ? `${account.code} - ` : ""}{account.name}
                  </option>
                ))}
            </select>
            <p className="text-xs text-muted-foreground">Parent group for expense accounts used in reports</p>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-border">
        <h2 className="text-lg font-medium text-foreground mb-4">HR Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label htmlFor="salaryDivisionDays" className="text-sm font-medium text-foreground">
              Salary Division Days
            </label>
            <input
              type="number"
              id="salaryDivisionDays"
              name="salaryDivisionDays"
              min="1"
              max="31"
              disabled={lockRestricted}
              defaultValue={initialSettings?.salaryDivisionDays || 30}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            />
            <p className="text-xs text-muted-foreground">Days used to calculate daily salary (e.g. 30)</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultSalaryExpenseAccount" className="text-sm font-medium text-foreground">
              Default Salary Expense Account
            </label>
            <select
              id="defaultSalaryExpenseAccount"
              name="defaultSalaryExpenseAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultSalaryExpenseAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}{account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Account to debit salary expenses</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultSalaryPayableAccount" className="text-sm font-medium text-foreground">
              Default Salary Payable Account
            </label>
            <select
              id="defaultSalaryPayableAccount"
              name="defaultSalaryPayableAccount"
              disabled={lockRestricted}
              defaultValue={getAccountSelectValue(initialSettings?.defaultSalaryPayableAccount)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-minia-primary text-foreground"
            >
              <option value="">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code ? `${account.code} - ` : ""}{account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Account to credit salary payable</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={loading || permissionsLoading || !canUpdateCompany}
          className="inline-flex items-center justify-center px-4 py-2 bg-minia-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-minia-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </button>

        {success && (
          <div className="flex items-center text-minia-success text-sm font-medium animate-in fade-in slide-in-from-left-2">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Settings saved successfully!
          </div>
        )}

        {error && (
          <div className="flex items-center text-minia-danger text-sm font-medium animate-in fade-in slide-in-from-left-2">
            <AlertCircle className="mr-2 h-4 w-4" />
            {error}
          </div>
        )}
      </div>
    </form>
  );
}
