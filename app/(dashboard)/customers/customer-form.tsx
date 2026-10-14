"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createCustomer,
  createSupplier,
  updateCustomer,
  updateSupplier,
} from "./actions";
import FormLabel from "@/components/ui/form-label";
import { SearchableSingleSelect } from "@/components/ui/searchable-select";
import { toastActionError, toastRaw as toast } from "@/components/providers/toast";

type Currency = {
  id: string;
  code: string;
  name: string;
};

type PartyFormData = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  ntn: string | null;
  strn: string | null;
  contactPerson: string | null;
  companyTypeId: string | null;
  companyType?: { id: string; title: string } | null;
  type?: string | null;
  isActive?: boolean;
  creditLimit?: number | null;
  creditDays?: number | null;
  creditStatus?: string | null;
  allowCreditOverride?: boolean | null;
  sellingPriceListId?: string | null;
  buyingPriceListId?: string | null;
};

interface CustomerFormProps {
  initialData?: PartyFormData | null;
  currencies: Currency[];
  companyTypes: Array<{ id: string; title: string }>;
  priceLists?: Array<{ id: string; name: string; type: string; isSystemDefault?: boolean; isActive?: boolean }>;
  mode?: "customer" | "supplier";
}

export default function CustomerForm({
  initialData,
  currencies,
  companyTypes,
  priceLists = [],
  mode = "customer",
}: CustomerFormProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(initialData);
  const router = useRouter();

  const isSupplierMode = mode === "supplier";
  const entityLabel = isSupplierMode ? "Supplier" : "Customer";
  const listPath = isSupplierMode ? "/suppliers" : "/customers";
  const allowedPartyTypeOptions = isSupplierMode
    ? [
        { label: "Supplier", value: "SUPPLIER" },
        { label: "Supplier + Customer", value: "BOTH" },
      ]
    : [
        { label: "Customer", value: "CUSTOMER" },
        { label: "Customer + Supplier", value: "BOTH" },
      ];

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);

    try {
      let result;
      if (isSupplierMode) {
        result = isEditing && initialData
          ? await updateSupplier(initialData.id, formData)
          : await createSupplier(formData);
      } else {
        result = isEditing && initialData
          ? await updateCustomer(initialData.id, formData)
          : await createCustomer(formData);
      }

      if (!result?.ok) {
        toastActionError(result ?? { ok: false, code: "INTERNAL", error: "No response received" });
        return;
      }

      toast.success(`${entityLabel} ${isEditing ? "updated" : "created"} successfully`);
      const redirect = (result?.data as any)?.redirectUrl;
      if (redirect) {
        router.push(redirect);
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      toastActionError(error, { fallback: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const currencyOptions = currencies.map((currency) => ({ label: `${currency.code} - ${currency.name}`, value: currency.code }));
  const companyTypeOptions = companyTypes.map((type) => ({ label: type.title, value: type.id }));
  const isSupplierPricing = isSupplierMode;
  const pricingFieldName = isSupplierPricing ? "buyingPriceListId" : "sellingPriceListId";
  const pricingLabel = isSupplierPricing ? "Buying Price List" : "Selling Price List";
  const pricingPlaceholder = "Use standard price list";
  const priceListOptions = priceLists
    .filter((list) => list.isActive !== false)
    .map((list) => ({
      label: `${list.name}${list.isSystemDefault ? " (Standard)" : ""}`,
      value: list.id,
    }));

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={listPath} className="p-2 hover:bg-accent rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{isEditing ? `Edit ${entityLabel}` : `New ${entityLabel}`}</h1>
            <p className="text-sm text-muted-foreground">
              {isSupplierMode
                ? "Manage supplier records used in purchase invoices and supplier payments."
                : "Manage customer records used for invoicing, payments, and credit control."}
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center px-4 py-2 bg-minia-primary text-white text-sm font-medium rounded-md hover:brightness-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? "Saving..." : `Save ${entityLabel}`}
        </button>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border p-6 space-y-8">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{entityLabel} Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <FormLabel htmlFor="name" required>
                {entityLabel} Name
              </FormLabel>
              <input id="name" name="name" required defaultValue={initialData?.name || ""} className="w-full px-3 py-2 border border-input bg-background rounded-md" />
            </div>

            <div className="space-y-2">
              <FormLabel>Relationship Type</FormLabel>
              <SearchableSingleSelect
                name="partyType"
                options={allowedPartyTypeOptions}
                defaultValue={initialData?.type && ["CUSTOMER", "SUPPLIER", "BOTH"].includes(initialData.type.toUpperCase()) ? initialData.type.toUpperCase() : (isSupplierMode ? "SUPPLIER" : "CUSTOMER")}
                placeholder="Select relationship type"
                isClearable={false}
              />
            </div>

            <div className="space-y-2">
              <FormLabel htmlFor="contactPerson">Contact Person</FormLabel>
              <input id="contactPerson" name="contactPerson" defaultValue={initialData?.contactPerson || ""} className="w-full px-3 py-2 border border-input bg-background rounded-md" />
            </div>

            <div className="space-y-2">
              <FormLabel>Company Type</FormLabel>
              <SearchableSingleSelect
                name="companyTypeId"
                options={companyTypeOptions}
                defaultValue={initialData?.companyTypeId || initialData?.companyType?.id || null}
                placeholder="Select company type"
                isClearable={true}
              />
            </div>

            <div className="space-y-2">
              <FormLabel htmlFor="ntn">NTN</FormLabel>
              <input id="ntn" name="ntn" defaultValue={initialData?.ntn || ""} className="w-full px-3 py-2 border border-input bg-background rounded-md" />
            </div>

            <div className="space-y-2">
              <FormLabel htmlFor="strn">STRN</FormLabel>
              <input id="strn" name="strn" defaultValue={initialData?.strn || ""} className="w-full px-3 py-2 border border-input bg-background rounded-md" />
            </div>

            <div className="space-y-2">
              <FormLabel required>Currency</FormLabel>
              <SearchableSingleSelect
                name="currency"
                options={currencyOptions}
                defaultValue={initialData?.currency || "PKR"}
                placeholder="Select currency"
                isClearable={false}
              />
            </div>

            <div className="space-y-2">
              <FormLabel htmlFor="phone">Phone</FormLabel>
              <input id="phone" name="phone" defaultValue={initialData?.phone || ""} className="w-full px-3 py-2 border border-input bg-background rounded-md" />
            </div>

            <div className="space-y-2">
              <FormLabel htmlFor="email">Email</FormLabel>
              <input id="email" type="email" name="email" defaultValue={initialData?.email || ""} className="w-full px-3 py-2 border border-input bg-background rounded-md" />
            </div>

            <div className="space-y-2">
              <FormLabel>Status</FormLabel>
              <SearchableSingleSelect
                name="isActive"
                options={[
                  { label: "Active", value: "true" },
                  { label: "Inactive", value: "false" },
                ]}
                defaultValue={initialData?.isActive === false ? "false" : "true"}
                placeholder="Select status"
                isClearable={false}
              />
            </div>

            <div className="space-y-2">
              <FormLabel>{pricingLabel}</FormLabel>
              <SearchableSingleSelect
                name={pricingFieldName}
                options={priceListOptions}
                defaultValue={
                  (isSupplierPricing ? initialData?.buyingPriceListId : initialData?.sellingPriceListId) || null
                }
                placeholder={pricingPlaceholder}
                isClearable={true}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use the system standard price list during invoicing.
              </p>
            </div>

            <div className="space-y-2 md:col-span-3">
              <FormLabel htmlFor="address">Address</FormLabel>
              <textarea id="address" name="address" rows={3} defaultValue={initialData?.address || ""} className="w-full px-3 py-2 border border-input bg-background rounded-md" />
            </div>
          </div>
        </section>

        {!isSupplierMode ? (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Credit Control</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <FormLabel htmlFor="creditLimit">Credit Limit</FormLabel>
                <input
                  id="creditLimit"
                  name="creditLimit"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={initialData?.creditLimit ?? 0}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                />
              </div>

              <div className="space-y-2">
                <FormLabel htmlFor="creditDays">Credit Days</FormLabel>
                <input
                  id="creditDays"
                  name="creditDays"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={initialData?.creditDays ?? 0}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                />
              </div>

              <div className="space-y-2">
                <FormLabel>Credit Status</FormLabel>
                <SearchableSingleSelect
                  name="creditStatus"
                  options={[
                    { label: "Active", value: "ACTIVE" },
                    { label: "On Hold", value: "ON_HOLD" },
                  ]}
                  defaultValue={initialData?.creditStatus === "ON_HOLD" ? "ON_HOLD" : "ACTIVE"}
                  placeholder="Select credit status"
                  isClearable={false}
                />
              </div>

              <div className="space-y-2">
                <FormLabel>Override Limit</FormLabel>
                <SearchableSingleSelect
                  name="allowCreditOverride"
                  options={[
                    { label: "No", value: "false" },
                    { label: "Yes", value: "true" },
                  ]}
                  defaultValue={initialData?.allowCreditOverride ? "true" : "false"}
                  placeholder="Select override"
                  isClearable={false}
                />
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </form>
  );
}
