"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type NavigationContextValue = {
  isNavigating: boolean;
  startNavigation: () => void;
};

const NavigationContext = createContext<NavigationContextValue>({
  isNavigating: false,
  startNavigation: () => {},
});

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startNavigation = () => {
    setIsNavigating(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsNavigating(false), 15000);
  };

  useEffect(() => {
    setIsNavigating(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [pathname]);

  return <NavigationContext.Provider value={{ isNavigating, startNavigation }}>{children}</NavigationContext.Provider>;
}

export function useNavigationLoader() {
  return useContext(NavigationContext);
}
