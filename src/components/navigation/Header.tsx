"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Search,
  Bookmark,
  Shield,
  User,
  LogOut,
  Shuffle,
  Compass,
  Menu,
  X,
  Sparkles,
  Clock,
  Heart,
  Settings,
} from "lucide-react";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Button } from "@/components/ui/Button";

export function Header() {
  const router = useRouter();
  const { user, fetchUser, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsMobileNavOpen(false);
      router.push(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleRandomManga = async () => {
    setIsMobileNavOpen(false);
    try {
      const res = await fetch("/api/manga?limit=1&sortBy=popularity");
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          router.push(`/manga/${data.items[0].slug}`);
        }
      }
    } catch {
      router.push("/browse");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full liquid-glass-header">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          {/* Brand Logo & Desktop Nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-cyan-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 border border-white/40 transition-transform group-hover:scale-105">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-base tracking-tight text-foreground flex items-center gap-1">
                  MANGA<span className="text-sky-400 font-extrabold">CMS</span>
                </span>
                <span className="text-[9px] tracking-widest uppercase text-muted-foreground font-bold -mt-1">
                  Reader Ecosystem
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-2 text-xs font-semibold">
              <Link
                href="/"
                className="px-3.5 py-1.5 rounded-full text-slate-300 hover:text-white liquid-glass-pill transition-all"
              >
                Home
              </Link>
              <Link
                href="/browse"
                className="px-3.5 py-1.5 rounded-full text-slate-300 hover:text-white liquid-glass-pill transition-all flex items-center gap-1.5"
              >
                <Compass className="h-3.5 w-3.5 text-sky-400" />
                Browse
              </Link>
              <Link
                href="/library"
                className="px-3.5 py-1.5 rounded-full text-slate-300 hover:text-white liquid-glass-pill transition-all flex items-center gap-1.5"
              >
                <Bookmark className="h-3.5 w-3.5 text-emerald-400" />
                Library
              </Link>
              <button
                onClick={handleRandomManga}
                className="px-3.5 py-1.5 rounded-full text-slate-300 hover:text-white liquid-glass-pill transition-all flex items-center gap-1.5"
              >
                <Shuffle className="h-3.5 w-3.5 text-cyan-400" />
                Random
              </button>
            </nav>
          </div>

          {/* Search Bar (Desktop) */}
          <div className="flex-1 max-w-md mx-4 hidden lg:block">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search manga, manhwa, authors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="liquid-glass-input pl-10 pr-4 py-1.5 text-xs rounded-full"
              />
            </form>
          </div>

          {/* Right Section / Auth & Mobile Hamburger */}
          <div className="flex items-center space-x-2.5">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 rounded-full border border-white/20 liquid-glass-pill p-1 hover:border-sky-400/40 transition-all"
                >
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white font-bold text-xs shadow-sm">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden md:inline text-xs font-semibold pr-2 text-slate-200">
                    {user.username}
                  </span>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/20 liquid-glass-elevated py-2 shadow-2xl z-50 animate-in fade-in">
                    <div className="px-4 py-2.5 border-b border-white/10">
                      <p className="text-xs font-bold text-foreground">{user.username}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono">
                        {user.role}
                      </span>
                    </div>

                    {(user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MODERATOR") && (
                      <Link
                        href="/admin"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/[0.08]"
                      >
                        <Shield className="h-3.5 w-3.5 text-sky-400" />
                        Admin Control Panel
                      </Link>
                    )}

                    <Link
                      href="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/[0.08]"
                    >
                      <User className="h-3.5 w-3.5 text-sky-400" />
                      User Profile
                    </Link>

                    <Link
                      href="/profile?tab=saved"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/[0.08]"
                    >
                      <Heart className="h-3.5 w-3.5 text-rose-400" />
                      Saved Titles
                    </Link>

                    <Link
                      href="/profile?tab=bookmarks"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/[0.08]"
                    >
                      <Bookmark className="h-3.5 w-3.5 text-emerald-400" />
                      Bookmarks
                    </Link>

                    <Link
                      href="/profile?tab=history"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/[0.08]"
                    >
                      <Clock className="h-3.5 w-3.5 text-cyan-400" />
                      Reading History
                    </Link>

                    <Link
                      href="/profile?tab=settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/[0.08]"
                    >
                      <Settings className="h-3.5 w-3.5 text-amber-400" />
                      Profile Settings
                    </Link>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-white/[0.08] border-t border-white/10 mt-1"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center space-x-2">
                <Link href="/login">
                  <Button variant="secondary" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="font-bold">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="md:hidden p-2 rounded-xl liquid-glass-pill text-foreground transition-all"
              aria-label="Toggle navigation menu"
            >
              {isMobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Glass Drawer */}
        {isMobileNavOpen && (
          <div className="md:hidden border-t border-white/15 liquid-glass-obsidian px-5 py-5 space-y-4 animate-in slide-in-from-top duration-200">
            {/* Mobile Search */}
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search manga, authors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="liquid-glass-input pl-10 pr-4 py-2.5 text-xs rounded-xl w-full"
              />
            </form>

            <nav className="space-y-1.5 font-semibold text-sm">
              <Link
                href="/"
                onClick={() => setIsMobileNavOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-foreground hover:bg-white/[0.08] transition-colors"
              >
                <BookOpen className="h-4 w-4 text-sky-400" />
                Home
              </Link>
              <Link
                href="/browse"
                onClick={() => setIsMobileNavOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-foreground hover:bg-white/[0.08] transition-colors"
              >
                <Compass className="h-4 w-4 text-sky-400" />
                Browse Catalog
              </Link>
              <Link
                href="/library"
                onClick={() => setIsMobileNavOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-foreground hover:bg-white/[0.08] transition-colors"
              >
                <Bookmark className="h-4 w-4 text-emerald-400" />
                Reading Library
              </Link>
              <button
                onClick={handleRandomManga}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-foreground hover:bg-white/[0.08] text-left transition-colors"
              >
                <Shuffle className="h-4 w-4 text-cyan-400" />
                Random Title
              </button>

              {user ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setIsMobileNavOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-foreground hover:bg-white/[0.08] transition-colors"
                  >
                    <User className="h-4 w-4 text-sky-400" />
                    My Profile
                  </Link>
                  <Link
                    href="/profile?tab=bookmarks"
                    onClick={() => setIsMobileNavOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-foreground hover:bg-white/[0.08] transition-colors"
                  >
                    <Bookmark className="h-4 w-4 text-emerald-400" />
                    Bookmarks
                  </Link>
                  <Link
                    href="/profile?tab=history"
                    onClick={() => setIsMobileNavOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-foreground hover:bg-white/[0.08] transition-colors"
                  >
                    <Clock className="h-4 w-4 text-cyan-400" />
                    Reading History
                  </Link>
                  <Link
                    href="/profile?tab=settings"
                    onClick={() => setIsMobileNavOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-foreground hover:bg-white/[0.08] transition-colors"
                  >
                    <Settings className="h-4 w-4 text-amber-400" />
                    Settings
                  </Link>
                  {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
                    <Link
                      href="/admin"
                      onClick={() => setIsMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-sky-300 bg-sky-500/10 border border-sky-400/25"
                    >
                      <Shield className="h-4 w-4 text-sky-400" />
                      Admin Console
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setIsMobileNavOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-rose-400 hover:bg-white/[0.08] text-left transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out ({user.username})
                  </button>
                </>
              ) : (
                <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-2">
                  <Link href="/login" onClick={() => setIsMobileNavOpen(false)}>
                    <Button variant="secondary" size="sm" className="w-full h-10">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setIsMobileNavOpen(false)}>
                    <Button size="sm" className="w-full h-10 font-bold">
                      Register
                    </Button>
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
