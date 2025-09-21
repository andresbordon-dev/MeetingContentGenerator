// src/app/(app)/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server";
import { getCalendarEvents } from "@/app/actions";
import { EventDashboardClient } from "./event-dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // This now returns our new structured data
  const accountsWithEvents = await getCalendarEvents();
  
  // Fetch the toggle state for all meetings for this user
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
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Upcoming Meetings</h1>
        </div>
        <EventDashboardClient 
          initialAccounts={accountsWithEvents} 
          initialEnabledIds={Array.from(enabledMeetingIds)}
        />
    </div>
  );
}