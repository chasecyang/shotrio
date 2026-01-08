"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useSearchParams, usePathname } from "next/navigation";

interface LoginDialogContextType {
  isOpen: boolean;
  openLoginDialog: (redirectTo?: string) => void;
  closeLoginDialog: () => void;
  redirectTo: string;
}

const LoginDialogContext = createContext<LoginDialogContextType | null>(null);

export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/projects");
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get("login") === "true") {
      const redirect = searchParams.get("redirect") || "/projects";
      setRedirectTo(redirect);
      setIsOpen(true);

      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("login");
      newParams.delete("redirect");
      const newUrl = newParams.toString() ? `${pathname}?${newParams.toString()}` : pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [searchParams, pathname]);

  const openLoginDialog = useCallback((redirect?: string) => {
    setRedirectTo(redirect || "/projects");
    setIsOpen(true);
  }, []);

  const closeLoginDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <LoginDialogContext.Provider value={{ isOpen, openLoginDialog, closeLoginDialog, redirectTo }}>
      {children}
    </LoginDialogContext.Provider>
  );
}

export function useLoginDialog() {
  const context = useContext(LoginDialogContext);
  if (!context) {
    throw new Error("useLoginDialog must be used within a LoginDialogProvider");
  }
  return context;
}
