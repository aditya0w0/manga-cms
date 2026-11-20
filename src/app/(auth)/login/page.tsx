"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LogIn, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/lib/store/use-auth-store";

export default function LoginPage() {
  const router = useRouter();
  const { fetchUser } = useAuthStore();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setIsLoading(false);
        return;
      }

      await fetchUser();
      if (data.user?.role === "ADMIN" || data.user?.role === "SUPER_ADMIN") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } catch {
      setError("An unexpected network error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-surface p-8 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md mb-2">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            Sign In to MangaCMS
          </h2>
          <p className="text-xs text-muted-foreground">
            Access your library, reading history, and synchronized preferences
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Username or Email
            </label>
            <Input
              type="text"
              required
              placeholder="e.g. admin or admin@mangacms.local"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="h-10"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Password
            </label>
            <Input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10"
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full h-10 font-bold gap-2">
            <LogIn className="h-4 w-4" />
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="pt-2 text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Register for free
          </Link>
        </div>

        {/* Demo credentials hint */}
        <div className="rounded-lg bg-surface-elevated border border-border/80 p-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Default Seed Accounts:</p>
          <p>Super Admin: <code className="text-primary font-mono">admin</code> / <code className="text-primary font-mono">AdminPassword123!</code></p>
          <p>Reader User: <code className="text-secondary font-mono">otaku_reader</code> / <code className="text-secondary font-mono">ReaderPassword123!</code></p>
        </div>
      </div>
    </div>
  );
}
