"use client";

import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-force-light min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Hero / Content */}
      <div className="hidden lg:flex lg:w-3/4 flex-col justify-between bg-minia-primary text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://themesbrand.com/minia-tailwindcss/assets/images/auth-bg.png')] bg-cover opacity-10"></div>
        <div className="relative z-10 h-full flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/logo_white.png"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/logo_white.svg";
              }}
              alt="TradeFix"
              className="h-10 w-auto object-contain max-w-[180px]"
            />
          </div>
          
          <div className="max-w-2xl">
            <h2 className="text-4xl font-semibold mb-6">Run your trade operations with clarity</h2>
            <p className="text-lg text-blue-100 mb-8">
              Manage customers, invoicing, payments, HR, journals, and reports in one unified TradeFix workspace.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex -space-x-4">
                <div className="h-10 w-10 rounded-full border-2 border-minia-primary bg-gray-200"></div>
                <div className="h-10 w-10 rounded-full border-2 border-minia-primary bg-gray-300"></div>
                <div className="h-10 w-10 rounded-full border-2 border-minia-primary bg-gray-400"></div>
            </div>
            <p className="text-sm font-medium">Built for modern trade and finance operations</p>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/4 flex items-center justify-center p-8 bg-white min-h-screen">
        <div className="w-full max-w-md space-y-8">
            {children}
        </div>
      </div>
    </div>
  );
}
