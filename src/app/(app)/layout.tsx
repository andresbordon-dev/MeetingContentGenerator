// src/app/(app)/layout.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header"; // The component we created earlier

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // This check now correctly protects ONLY the pages in the (app) group.
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