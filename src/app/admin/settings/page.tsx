"use client";

import React from "react";
import { Settings, ShieldCheck, Database, HardDrive, Key, Globe } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl pb-16">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5 text-sky-400" />
          Settings
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Security Rules */}
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-semibold text-slate-200">Network Security</h2>
          </div>
          <div className="space-y-1 text-xs font-mono text-slate-400 pt-1">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="font-sans text-slate-400">Localhost:</span>
              <span className="text-emerald-400 font-medium">Blocked</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="font-sans text-slate-400">Private IPv4:</span>
              <span className="text-emerald-400 font-medium">Blocked (RFC 1918)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="font-sans text-slate-400">Cloud Metadata:</span>
              <span className="text-emerald-400 font-medium">Blocked (169.254.169.254)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="font-sans text-slate-400">DNS Re-validation:</span>
              <span className="text-emerald-400 font-medium">Enabled</span>
            </div>
          </div>
        </div>

        {/* Database & Persistence */}
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-sky-400" />
            <h2 className="text-xs font-semibold text-slate-200">Database</h2>
          </div>
          <div className="space-y-1 text-xs font-mono text-slate-400 pt-1">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="font-sans text-slate-400">Engine:</span>
              <span className="text-slate-200 font-medium">PostgreSQL (PGlite / Native)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="font-sans text-slate-400">ORM:</span>
              <span className="text-slate-200 font-medium">Prisma 6</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="font-sans text-slate-400">Driver Adapter:</span>
              <span className="text-slate-200 font-medium">@prisma/adapter-pg</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="font-sans text-slate-400">Schema Models:</span>
              <span className="text-emerald-400 font-medium">25 Normalized</span>
            </div>
          </div>
        </div>

        {/* Media Storage */}
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-slate-400" />
            <h2 className="text-xs font-semibold text-slate-200">Storage</h2>
          </div>
          <div className="space-y-1 text-xs font-mono text-slate-400 pt-1">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="font-sans text-slate-400">Provider:</span>
              <span className="text-slate-200 font-medium">{process.env.STORAGE_PROVIDER || "Local Filesystem"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="font-sans text-slate-400">Storage Directory:</span>
              <span className="text-slate-400 truncate">data/storage/media</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="font-sans text-slate-400">ZIP Extraction:</span>
              <span className="text-emerald-400 font-medium">Natural Order</span>
            </div>
          </div>
        </div>

        {/* Cryptographic Security */}
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-amber-400" />
            <h2 className="text-xs font-semibold text-slate-200">Authentication & Secrets</h2>
          </div>
          <div className="space-y-1 text-xs font-mono text-slate-400 pt-1">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="font-sans text-slate-400">Encryption:</span>
              <span className="text-slate-200 font-medium">AES-256-GCM</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="font-sans text-slate-400">Password Hash:</span>
              <span className="text-slate-200 font-medium">Bcrypt</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="font-sans text-slate-400">Sessions:</span>
              <span className="text-emerald-400 font-medium">Signed JWT Cookie</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
