// src/app/actions.ts
'use server'

import { createClient } from "@/lib/supabase/server";
import { google } from "googleapis";
import { revalidatePath } from "next/cache";

// Define a type for our calendar events for type safety
export type CalendarEvent = {
  id: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  attendees?: { email: string; responseStatus: string }[];
  description?: string;
  location?: string;
};

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data: accounts, error } = await supabase
    .from('connected_accounts')
    .select('access_token, refresh_token')
    .eq('user_id', user.id)
    .eq('provider', 'google');
    
  if (error || !accounts) {
    console.error("Error fetching connected accounts:", error);
    return [];
  }

  const allEvents: CalendarEvent[] = [];

  for (const account of accounts) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    // Simple token refresh logic (a more robust solution would handle errors and update the DB)
    // For this challenge, we assume the token is valid or refreshable.
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        maxResults: 15,
        singleEvents: true,
        orderBy: 'startTime',
      });
      
      const events = response.data.items;
      if (events && events.length) {
        const formattedEvents = events.map((event) => ({
          id: event.id!,
          title: event.summary || 'No Title',
          startTime: event.start?.dateTime || event.start?.date || undefined,
          endTime: event.end?.dateTime || event.end?.date || undefined,
          attendees: event.attendees?.map(a => ({ email: a.email!, responseStatus: a.responseStatus! })) || [],
          description: event.description || '',
          location: event.location || '',
        }));
        allEvents.push(...formattedEvents);
      }
    } catch (err) {
        console.error('The API returned an error for an account: ' + err);
        // In a real app, you would handle token refresh errors here
    }
  }

  // Sort all events from all calendars by start time
  allEvents.sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());

  return allEvents;
}

// This action will be called when a user toggles the switch
export async function toggleMeetingTranscription(event: CalendarEvent, isEnabled: boolean) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    // Basic function to find a meeting link
    const findMeetingUrl = (text: string): string | null => {
        const urlRegex = /(https?:\/\/(?:www\.)?(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com)[\S]+)/g;
        const matches = text.match(urlRegex);
        return matches ? matches[0] : null;
    };
    
    const meetingUrl = findMeetingUrl(`${event.location} ${event.description}`);

    const { error } = await supabase
        .from('meetings')
        .upsert({
            user_id: user.id,
            gcal_event_id: event.id,
            title: event.title,
            start_time: event.startTime,
            end_time: event.endTime,
            is_transcription_enabled: isEnabled,
            meeting_url: meetingUrl,
            // Simple platform detection
            platform: meetingUrl?.includes('zoom') ? 'zoom' : meetingUrl?.includes('google') ? 'gmeet' : meetingUrl?.includes('teams') ? 'msteams' : null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id, gcal_event_id'});

    if (error) {
        console.error("Error toggling transcription:", error);
        throw new Error("Failed to update meeting setting.");
    }

    // Revalidate the dashboard path to show changes
    revalidatePath('/dashboard');
}