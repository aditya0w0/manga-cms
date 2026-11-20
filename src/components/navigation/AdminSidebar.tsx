"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  Image,
  Flag,
  FileText,
  Settings,
  ArrowLeft,
  Shield,
  ShieldAlert,
  Tag,
  X,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: any;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    title: "Catalog",
    items: [
      { name: "Overview", href: "/admin", icon: LayoutDashboard },
      { name: "Manga", href: "/admin/manga", icon: BookOpen },
      { name: "Chapters", href: "/admin/chapters", icon: Layers },
      { name: "Media", href: "/admin/media", icon: Image },
      { name: "Genres", href: "/admin/genres", icon: Tag },
    ],
  },
  {
    title: "Moderation",
    items: [
      { name: "Content Policy", href: "/admin/settings/content-policy", icon: ShieldAlert },
      { name: "Reports", href: "/admin/reports", icon: Flag },
      { name: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
    ],
  },
  {
    title: "System",
    items: [
      { name: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ isOpen = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (onClose) onClose();
  }, [pathname]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle Escape key navigation dismissal for mobile drawer
  useEffect(() => {
    if (!isOpen || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-sky-400 font-bold">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-foreground">
                Manga<span className="text-sky-400 font-extrabold">CMS</span>
              </span>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-foreground hover:bg-slate-800 transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Grouped Navigation */}
        <nav className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-8.5rem)]">
          {navigationSections.map((sec) => (
            <div key={sec.title} className="space-y-0.5">
              <span className="px-3 text-xs font-medium text-slate-500 block pb-1">
                {sec.title}
              </span>

              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-slate-800 text-sky-300 font-semibold"
                        : "text-slate-400 hover:text-foreground hover:bg-slate-900/60"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 transition-colors ${
                        isActive ? "text-sky-400" : "text-slate-500"
                      }`}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Exit to Public Reader */}
      <div className="p-3 border-t border-slate-800">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-foreground hover:bg-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-slate-500" />
          <span>View Site</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex w-64 shrink-0 border-r border-slate-800 bg-slate-950 flex-col min-h-screen sticky top-0 h-screen shadow-xl">
        {sidebarContent}
      </aside>

      {isOpen && (
        <div
          id="admin-sidebar"
          role="dialog"
          aria-modal="true"
          aria-label="Admin Navigation"
          className="fixed inset-0 z-50 md:hidden"
        >
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-950 border-r border-slate-800 shadow-2xl z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
