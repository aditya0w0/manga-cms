import React from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 liquid-glass text-muted-foreground">
      <div className="container mx-auto px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Brand & Purpose (Col 1-6) */}
          <div className="md:col-span-6 space-y-3">
            <Link href="/" className="inline-flex items-center space-x-2.5 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl liquid-glass text-white border border-white/25 shadow-md group-hover:scale-105 transition-transform">
                <BookOpen className="h-4 w-4 text-sky-400" />
              </div>
              <span className="font-extrabold text-base tracking-tight text-foreground">
                MANGA<span className="text-sky-400 font-black">CMS</span>
              </span>
            </Link>
            <p className="text-xs text-slate-300 leading-relaxed max-w-md">
              A private reader for local manga, manhwa, and webtoon archives. Read in your browser, track chapter progress, and manage imports on your own server.
            </p>
            <div className="flex items-center gap-3 pt-0.5 text-xs">
              <span className="font-mono text-[11px] px-2.5 py-1 rounded-md bg-white/[0.06] border border-white/10 text-slate-300">
                v1.0
              </span>
              <Link
                href="/admin"
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Admin
              </Link>
            </div>
          </div>

          {/* Navigation (Col 7-9) */}
          <div className="md:col-span-3 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Navigation
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link href="/browse" className="text-slate-300 hover:text-white transition-colors">
                  All Titles
                </Link>
              </li>
              <li>
                <Link href="/browse?sortBy=updated" className="text-slate-300 hover:text-white transition-colors">
                  Latest Releases
                </Link>
              </li>
              <li>
                <Link href="/browse?sortBy=rating" className="text-slate-300 hover:text-white transition-colors">
                  Top Rated
                </Link>
              </li>
              <li>
                <Link href="/library" className="text-slate-300 hover:text-white transition-colors">
                  Reading History
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal / Archival Notice (Col 10-12) */}
          <div className="md:col-span-3 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Notice
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              For private libraries and local archival. Character names, artwork, and trademarks remain the property of their original creators and publishers.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <p>© 2026 MangaCMS. Self-hosted personal edition.</p>
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
            <span>Obsidian Theme</span>
            <span>Local Database</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
