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
        console.log("getCalendarEvents: User not authenticated");
        return [];
    }

    // 1. Select all necessary fields, including the ID and expires_at timestamp
    const { data: accounts, error } = await supabase
        .from('connected_accounts')
        .select('id, access_token, refresh_token, expires_at')
        .eq('user_id', user.id)
        .eq('provider', 'google');

    if (error) {
        console.error("Error fetching connected accounts:", error);
        return [];
    }

    if (!accounts || accounts.length === 0) {
        console.log("No connected Google accounts found for this user.");
        return [];
    }

    console.log(`Found ${accounts.length} Google account(s) to process.`);
    const allEvents: CalendarEvent[] = [];

    // Create a single OAuth2 client instance to be used in the loop
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    for (const account of accounts) {
        if (!account.access_token || !account.refresh_token || !account.expires_at) {
            console.warn(`Skipping account ${account.id} due to missing token info.`);
            continue;
        }

        let currentAccessToken = account.access_token;

        // 2. Check if the token is expired or will expire in the next minute
        const isExpired = new Date(account.expires_at) < new Date(Date.now() + 60 * 1000);

        if (isExpired) {
            console.log(`Token for account ${account.id} is expired. Refreshing...`);
            try {
                oauth2Client.setCredentials({ refresh_token: account.refresh_token });
                const { credentials } = await oauth2Client.refreshAccessToken();

                currentAccessToken = credentials.access_token!;
                const newExpiresAt = new Date();
                newExpiresAt.setSeconds(newExpiresAt.getSeconds() + (credentials.expiry_date! - Date.now()) / 1000);

                // 3. IMPORTANT: Update the database with the new token
                const { error: updateError } = await supabase
                    .from('connected_accounts')
                    .update({
                        access_token: credentials.access_token,
                        expires_at: newExpiresAt.toISOString(),
                        // A new refresh token is sometimes returned, update it if available
                        ...(credentials.refresh_token && { refresh_token: credentials.refresh_token }),
                    })
                    .eq('id', account.id);

                if (updateError) {
                    console.error("Failed to update new token in database:", updateError);
                } else {
                    console.log(`Successfully refreshed and saved token for account ${account.id}`);
                }
            } catch (refreshError: unknown) {
                const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
                console.error(`Failed to refresh token for account ${account.id}:`, message);
                // If refresh fails, we can't use this account, so we skip to the next one.
                continue;
            }
        }

        // 4. Use the valid token to fetch calendar events
        try {
            oauth2Client.setCredentials({ access_token: currentAccessToken });
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const timeMin = new Date().toISOString();
            const timeMax = new Date();
            timeMax.setDate(timeMax.getDate() + 30); // Fetch events for the next 30 days

            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: timeMin,
                timeMax: timeMax.toISOString(),
                maxResults: 15,
                singleEvents: true,
                orderBy: 'startTime',
            });

            const events = response.data.items;
            if (events && events.length) {
                console.log(`Fetched ${events.length} events for account ${account.id}`);
                const formattedEvents = events.map((event) => ({
                    id: event.id!,
                    title: event.summary || 'No Title',
                    startTime: event.start?.dateTime || event.start?.date || undefined,
                    endTime: event.end?.dateTime || event.end?.date || undefined,
                    attendees: event.attendees?.filter(a => a.email).map(a => ({
                        email: a.email!,
                        responseStatus: a.responseStatus!
                    })) || [],
                    description: event.description || '',
                    location: event.location || '',
                }));
                allEvents.push(...formattedEvents);
            }
        } catch (apiError: unknown) {
            const message = apiError instanceof Error ? apiError.message : String(apiError);
            console.error(`The Google Calendar API returned an error for account ${account.id}:`, message);
        }
    }

    // Sort all events from all calendars together
    allEvents.sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());
    console.log(`Total events fetched from all accounts: ${allEvents.length}`);
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
        }, { onConflict: 'user_id, gcal_event_id' });

    if (error) {
        console.error("Error toggling transcription:", error);
        throw new Error("Failed to update meeting setting.");
    }

    // Revalidate the dashboard path to show changes
    revalidatePath('/dashboard');
}

export async function postToLinkedIn(content: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'User not authenticated.' };
    }

    const { data: account, error: accountError } = await supabase
        .from('connected_accounts')
        .select('access_token, provider_user_id')
        .eq('user_id', user.id)
        .eq('provider', 'linkedin')
        .single();

    if (accountError || !account) {
        return { error: 'LinkedIn account not connected.' };
    }

    try {
        const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${account.access_token}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            },
            body: JSON.stringify({
                author: `urn:li:person:${account.provider_user_id}`,
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: { text: content },
                        shareMediaCategory: 'NONE'
                    }
                },
                visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'CONNECTIONS' }
            })
        });

        if (!postResponse.ok) {
            const errorData = await postResponse.json();
            console.error("LinkedIn API Error:", errorData);
            throw new Error(errorData.message || 'Failed to post to LinkedIn.');
        }

        return { success: true };

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
    }
}