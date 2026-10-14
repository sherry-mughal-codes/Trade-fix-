"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  expandSidebar: () => void;
  collapseSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem("sidebarCollapsed");
    if (stored) {
      setIsCollapsed(stored === "true");
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", String(newState));
  };

  const expandSidebar = () => {
    setIsCollapsed(false);
    localStorage.setItem("sidebarCollapsed", "false");
  };

  const collapseSidebar = () => {
    setIsCollapsed(true);
    localStorage.setItem("sidebarCollapsed", "true");
  };

  // Avoid hydration mismatch by not rendering until mounted (or handle initial state carefully)
  // For layout purposes, we might want a default.
  
  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleSidebar,
        expandSidebar,
        collapseSidebar,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
