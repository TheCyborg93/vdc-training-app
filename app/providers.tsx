"use client";

import type { ReactNode } from "react";
import { AppFeedbackProvider } from "@/components/ui/app-feedback";

export default function Providers({ children }: { children: ReactNode }) {
  return <AppFeedbackProvider>{children}</AppFeedbackProvider>;
}
