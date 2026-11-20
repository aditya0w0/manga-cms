import React from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 liquid-glass text-muted-foreground">
      <div className="container mx-auto px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Brand & Self-Hosting Overview (Col 1-6) */}
          <div className="md:col-span-6 space-y-3.5">
            <Link href="/" className="inline-flex items-center space-x-2.5 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl liquid-glass text-white border border-white/25 shadow-md group-hover:scale-105 transition-transform">
                <BookOpen className="h-4 w-4 text-sky-400" />
              </div>
              <span className="font-extrabold text-base tracking-tight text-foreground">
                MANGA<span className="text-sky-400 font-black">CMS</span>
              </span>
            </Link>
            <p className="text-xs text-slate-300 leading-relaxed max-w-md">
              Self-hosted comic and webtoon reader ecosystem with headless content management,
              lossless WebP optimization, and custom public API integration.
            </p>
            <div className="flex items-center gap-3 pt-1 text-xs">
              <span className="font-mono text-[11px] px-2.5 py-1 rounded-md bg-white/[0.06] border border-white/10 text-slate-300">
                Self-Hosted Edition v1.0
              </span>
              <Link
                href="/admin"
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Admin Panel
              </Link>
            </div>
          </div>

          {/* Quick Reader Shortcuts (Col 7-9) */}
          <div className="md:col-span-3 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Reader Shortcuts
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link href="/browse" className="text-slate-300 hover:text-white transition-colors">
                  Browse Catalog
                </Link>
              </li>
              <li>
                <Link href="/browse?sortBy=updated" className="text-slate-300 hover:text-white transition-colors">
                  Latest Chapter Releases
                </Link>
              </li>
              <li>
                <Link href="/browse?sortBy=rating" className="text-slate-300 hover:text-white transition-colors">
                  Top Ranked Series
                </Link>
              </li>
              <li>
                <Link href="/library" className="text-slate-300 hover:text-white transition-colors">
                  Personal Reading Library
                </Link>
              </li>
            </ul>
          </div>

          {/* Content & Copyright Disclaimer (Col 10-12) */}
          <div className="md:col-span-3 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Content Disclaimer
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              All comics, artwork, character names, and trademarks belong to their respective authors and publishers. MangaCMS functions solely as a personal indexer and reader interface.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <p>© 2026 MangaCMS Ecosystem. Built for personal scanlation archival and reading.</p>
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
            <span>Dark Obsidian Theme</span>
            <span>Local Database Storage</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
