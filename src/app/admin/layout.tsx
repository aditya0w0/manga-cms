"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AdminSidebar } from "@/components/navigation/AdminSidebar";
import { Menu, ExternalLink } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased selection:bg-sky-500/30 selection:text-sky-200">
      {/* Responsive Sidebar (Sticky on Desktop, Slide-over Glass Drawer on Mobile) */}
      <AdminSidebar
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-800 bg-slate-950 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Hamburger Button for Mobile */}
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="md:hidden p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-foreground transition-colors"
              aria-label="Open navigation menu"
              aria-expanded={isMobileNavOpen}
              aria-controls="admin-sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumb Title */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground hidden sm:inline">Admin</span>
              <span className="text-muted-foreground/40 hidden sm:inline">/</span>
              <span className="text-foreground font-bold tracking-tight text-sm">
                Management Console
              </span>
            </div>
          </div>

          {/* Right Header Navigation */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-colors"
            >
              <span>View Site</span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
          </div>
        </header>

        {/* Dynamic Page Content with Responsive Padding */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
