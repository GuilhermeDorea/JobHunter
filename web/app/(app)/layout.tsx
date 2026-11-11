import { Suspense, type ReactNode } from "react";
import Shell from "@/components/Shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
