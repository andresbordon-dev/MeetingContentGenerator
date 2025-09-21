// src/app/(app)/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server";
// We will import this type from actions.ts instead
// import { AccountWithEvents, getCalendarEvents } from "@/app/actions";
import { getCalendarEvents } from "@/app/actions";
import { DashboardClient } from "./dashboard-client";
import { unstable_noStore as noStore } from 'next/cache';
import { MeetingTileInfo } from "./dashboard-client"; // Move type definition to client

export default async function DashboardPage() {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Fetch Upcoming Meetings (this already returns grouped data)
  const accountsWithEvents = await getCalendarEvents();
  
  // 2. Fetch Past Meetings (this remains flat)
  const { data: pastMeetingsData } = await supabase
    .from('meetings')
    .select('*')
    .in('status', ['completed', 'processing', 'error'])
    .order('start_time', { ascending: false });
  
  const pastMeetings: MeetingTileInfo[] = pastMeetingsData?.map(meeting => ({
    id: meeting.id,
    title: meeting.title || "Untitled Meeting",
    startTime: meeting.start_time,
    isUpcoming: false,
    status: meeting.status as any,
  })) || [];

  // 3. Fetch the toggle state for all meetings
  const { data: meetingsData } = await supabase
    .from('meetings')
    .select('gcal_event_id, is_transcription_enabled')
    .eq('user_id', user!.id);

  const enabledMeetingIds = new Set(
    meetingsData
      ?.filter(m => m.is_transcription_enabled)
      .map(m => m.gcal_event_id)
  );

  return (
    <div>
        <h1 className="text-2xl font-bold mb-6">Meetings Dashboard</h1>
        <DashboardClient 
          // --- PASS THE GROUPED DATA DIRECTLY ---
          accountsWithEvents={accountsWithEvents}
          pastMeetings={pastMeetings}
          initialEnabledIds={Array.from(enabledMeetingIds)}
        />
    </div>
  );
}