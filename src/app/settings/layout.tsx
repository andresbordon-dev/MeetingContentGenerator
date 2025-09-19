// src/app/settings/layout.tsx
import React, { JSX } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Re-usable Header Component (can be extracted to its own file later)
function Header() {
  return (
    <header className="border-b">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/dashboard" className="font-bold text-lg">ContentGen AI</Link>
          <div className="flex items-baseline space-x-4">
            <Link href="/dashboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Upcoming</Link>
            <Link href="/meetings" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Past Meetings</Link>
            <Link href="/settings" className="text-sm font-medium text-primary">Settings</Link>
          </div>
        </div>
        {/* Add Sign Out button here later */}
      </nav>
    </header>
  );
}

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<JSX.Element> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div>
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}