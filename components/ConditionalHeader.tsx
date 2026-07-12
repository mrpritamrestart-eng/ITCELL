"use client";

import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";

export default function ConditionalHeader() {
  const pathname = usePathname();
  if (pathname === "/admin/login") return null;
  return <AppHeader />;
}
