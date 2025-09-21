// src/app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCalendarEvents } from "../actions";
import { EventList } from "./event-list";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirect('/auth/login');
  }

  const events = await getCalendarEvents();

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
  
  // We also need to get the current state of our meetings from our DB
  const { data: meetingsData } = await supabase
    .from('meetings')
    .select('gcal_event_id, is_transcription_enabled')
    .eq('user_id', user.id);

  const enabledEvents = new Set(
    meetingsData?.map(m => m.gcal_event_id)
  );
  
  const eventsWithToggleState = events.map(event => ({
    ...event,
    isTranscriptionEnabled: enabledEvents.has(event.id)
  }));

  return (
    <div className="container mx-auto p-4 md:p-8">
        <Header />
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Upcoming Meetings</h1>
            {/* We can add a "Connect another account" button here later */}
        </div>
        <EventList initialEvents={eventsWithToggleState} />
    </div>
  );
}