// src/components/header.tsx
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { signOut } from "@/app/actions";

// A small helper component to keep the main component clean
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  // Use startsWith to handle nested routes like /meetings/:id
  const isActive = pathname.startsWith(href);

  return (
    <Link 
      href={href} 
      className={cn(
        "text-sm font-medium transition-colors hover:text-primary",
        isActive ? "text-primary font-semibold" : "text-muted-foreground"
      )}
    >
      {children}
    </Link>
  );
}

export function Header() {
  return (
    <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/dashboard" className="font-bold text-lg">ContentGen AI</Link>
          <div className="hidden md:flex items-baseline space-x-4">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/settings">Settings</NavLink>
          </div>
        </div>
        <form action={signOut}>
            <Button variant="outline" size="sm">Sign Out</Button>
        </form>
      </nav>
    </header>
  );
}