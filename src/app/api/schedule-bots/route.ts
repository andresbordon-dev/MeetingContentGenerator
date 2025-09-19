// src/app/api/schedule-bots/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers"; // Make sure this is imported

export async function GET(request: Request) {
  // SECURE THE ENDPOINT
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // ... rest of the function remains the same
  const supabase = createClient();
  // ...
}