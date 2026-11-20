import Link from "next/link";
import { BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] liquid-glass text-muted-foreground mt-20">
      <div className="container mx-auto px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.4)]">
                <BookOpen className="h-4 w-4" />
              </div>
              <span className="font-extrabold text-base tracking-tight text-foreground">
                MANGA<span className="text-cyan-400 font-black">CMS</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed">
              Universal Manga Reader Ecosystem with Headless CMS and dynamic external API integration engine.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Discovery</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/browse?status=ONGOING" className="hover:text-cyan-400 transition-colors">
                  Ongoing Series
                </Link>
              </li>
              <li>
                <Link href="/browse?status=COMPLETED" className="hover:text-cyan-400 transition-colors">
                  Completed Titles
                </Link>
              </li>
              <li>
                <Link href="/browse?contentType=MANHWA" className="hover:text-cyan-400 transition-colors">
                  Popular Manhwa
                </Link>
              </li>
              <li>
                <Link href="/browse?contentType=WEBTOON" className="hover:text-cyan-400 transition-colors">
                  Webtoons
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Subsystems</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/admin" className="hover:text-cyan-400 transition-colors">
                  Headless CMS
                </Link>
              </li>
              <li>
                <Link href="/admin/providers" className="hover:text-cyan-400 transition-colors">
                  Universal API Engine
                </Link>
              </li>
              <li>
                <Link href="/admin/media" className="hover:text-cyan-400 transition-colors">
                  Media Library
                </Link>
              </li>
              <li>
                <Link href="/admin/imports" className="hover:text-cyan-400 transition-colors">
                  Sync & Importer
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Security & Architecture</h4>
            <p className="text-xs leading-relaxed">
              Equipped with strict server-side SSRF validation, private IP blocking, encrypted credentials at rest, and normalized internal models.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between text-xs">
          <p>© {new Date().getFullYear()} MangaCMS Ecosystem. Open self-hostable platform.</p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <span className="text-emerald-400 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              All Systems Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
