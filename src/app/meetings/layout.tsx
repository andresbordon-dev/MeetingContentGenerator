// src/app/meetings/layout.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// A simple navigation header component
function Header() {
  // We will add a sign out button later
  return (
    <header className="border-b">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/dashboard" className="font-bold text-lg">ContentGen AI</Link>
          <div className="flex items-baseline space-x-4">
            <Link href="/dashboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
              Upcoming
            </Link>
            <Link href="/meetings" className="text-sm font-medium text-primary">
              Past Meetings
            </Link>
            {/* We will add a Settings link later */}
          </div>
        </div>
      </nav>
    </header>
  );
}

export default async function MeetingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
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