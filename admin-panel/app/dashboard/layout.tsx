import type { ReactNode } from "react";
import Protected from "@/components/Protected";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Protected>
      <div style={{ display: "flex" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 32, maxWidth: 960 }}>{children}</main>
      </div>
    </Protected>
  );
}
