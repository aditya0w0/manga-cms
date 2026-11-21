import React from "react";

export default function ReaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-black text-white overflow-x-hidden selection:bg-sky-500/30">
      {children}
    </div>
  );
}
