"use client";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import { useState } from "react";

export default function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="md:hidden p-2 hover:bg-gray-100 rounded-full transition-colors">
          <Menu className="h-6 w-6 text-gray-600" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 bg-white border-r border-gray-200 w-64 [&>button]:text-gray-600">
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}
