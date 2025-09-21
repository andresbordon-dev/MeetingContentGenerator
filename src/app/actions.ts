'use server'

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { google } from "googleapis";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type CalendarEvent = {
    id: string;
    title?: string;
    startTime?: string;
    endTime?: string;
    attendees?: { email: string; responseStatus: string }[];
    description?: string;
    location?: string;
};

export type AccountWithEvents = {
    accountEmail: string;
    events: CalendarEvent[];
};

interface MeetingForBotCreation {
    title?: string;
    meeting_url: string | null;
    start_time?: string;
    end_time?: string;
    platform: string | null;
}

export async function getCalendarEvents(): Promise<AccountWithEvents[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        console.log("getCalendarEvents: User not authenticated");
        return [];
    }

    const { data: accounts, error } = await supabase
        .from('connected_accounts')
        .select('id, access_token, refresh_token, expires_at, provider_user_email')
        .eq('user_id', user.id)
        .eq('provider', 'google');

    if (error || !accounts) {
        console.error("Error fetching connected accounts:", error);
        return [];
    }

    console.log(accounts.length, "connected Google accounts found for user", user.id);
    const allAccountsWithEvents: AccountWithEvents[] = [];
    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);

    for (const account of accounts) {
        if (!account.access_token || !account.refresh_token || !account.expires_at) {
            console.warn(`Skipping account ${account.id} due to missing token info.`);
            continue;
        }

        let currentAccessToken = account.access_token;

        const isExpired = new Date(account.expires_at) < new Date(Date.now() + 60 * 1000);

        if (isExpired) {
            console.log(`Token for account ${account.id} is expired. Refreshing...`);
            try {
                oauth2Client.setCredentials({ refresh_token: account.refresh_token });
                const { credentials } = await oauth2Client.refreshAccessToken();

                currentAccessToken = credentials.access_token!;
                const newExpiresAt = new Date();
                newExpiresAt.setSeconds(newExpiresAt.getSeconds() + (credentials.expiry_date! - Date.now()) / 1000);

                const { error: updateError } = await supabase
                    .from('connected_accounts')
                    .update({
                        access_token: credentials.access_token,
                        expires_at: newExpiresAt.toISOString(),
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
                continue;
            }
        }

        try {
            oauth2Client.setCredentials({ access_token: currentAccessToken });
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const response = await calendar.events.list({
                calendarId: 'primary',
                maxResults: 500,
                singleEvents: true,
                orderBy: 'startTime',
            });

            const events = response.data.items;
            let formattedEvents: CalendarEvent[] = [];
            if (events && events.length) {
                console.log(`Fetched ${events.length} events for account ${account.id}`);

                console.log("All Events: ", events);
                const now = new Date();
                const upcomingEvents = events.filter(event => {
                    const startTime = event.start?.dateTime || event.start?.date;
                    if (!startTime) return false; 
                    console.log("Event Start Time: ", new Date(startTime));
                    console.log(new Date(startTime) > now);
                    return new Date(startTime) > now;
                });
                console.log("Upcoming Events: ", upcomingEvents);
                formattedEvents = upcomingEvents.map((event) => ({
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
                allAccountsWithEvents.push({
                    accountEmail: account.provider_user_email || `Account ${account.id.substring(0, 6)}`,
                    events: formattedEvents.sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
                });
            }
        } catch (apiError: unknown) {
            const message = apiError instanceof Error ? apiError.message : String(apiError);
            console.error(`API error for account ${account.provider_user_email}:`, message);
            allAccountsWithEvents.push({
                accountEmail: account.provider_user_email || "Error Account",
                events: []
            });
        }
    }
    console.log(allAccountsWithEvents);
    return allAccountsWithEvents;
}

async function createRecallBot(meeting: MeetingForBotCreation): Promise<string | null> {
    const recallApiKey = process.env.RECALL_API_KEY;
    
    if (!recallApiKey) {
        console.error("RECALL_API_KEY is not set.");
        return null;
    }

    try {
        const botResponse = await fetch('https://api.recall.ai/api/v1/bots/', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${recallApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bot_name: `Meeting Bot - ${meeting.title || 'Untitled'}`,
                calendar_invite: {
                    meeting_url: meeting.meeting_url,
                    start_time: meeting.start_time,
                    end_time: meeting.end_time
                },
                ...(meeting.platform === 'zoom' && {
                    zoom: {
                        meeting_url: meeting.meeting_url
                    }
                }),
                ...(meeting.platform === 'gmeet' && {
                    google_meet: {
                        meeting_url: meeting.meeting_url
                    }
                }),
                ...(meeting.platform === 'msteams' && {
                    teams: {
                        meeting_url: meeting.meeting_url
                    }
                })
            })
        });

        if (!botResponse.ok) {
            const errorData = await botResponse.json();
            console.error("Failed to create recall.ai bot:", errorData);
            return null;
        }

        const botData = await botResponse.json();
        return botData.id;
    } catch (error) {
        console.error("Error creating recall.ai bot:", error);
        return null;
    }
}

export async function toggleMeetingTranscription(event: CalendarEvent, isEnabled: boolean) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    const findMeetingUrl = (text: string): string | null => {
        const urlRegex = /(https?:\/\/(?:www\.)?(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com)[\S]+)/g;
        const matches = text.match(urlRegex);
        return matches ? matches[0] : null;
    };

    const meetingUrl = findMeetingUrl(`${event.location} ${event.description}`);
    const platform = meetingUrl?.includes('zoom') ? 'zoom' : 
                    meetingUrl?.includes('google') ? 'gmeet' : 
                    meetingUrl?.includes('teams') ? 'msteams' : null;

    let recallBotId: string | null = null;
    let status = 'pending';

    if (isEnabled && meetingUrl) {
        const botId = await createRecallBot({
            title: event.title,
            meeting_url: meetingUrl,
            start_time: event.startTime,
            end_time: event.endTime,
            platform
        });
        
        if (botId) {
            recallBotId = botId;
            status = 'scheduled';
        } else {
            console.warn("Failed to create recall.ai bot, but continuing with meeting setup");
            status = 'error';
        }
    } else if (!isEnabled) {
        status = 'cancelled';
    }

    const meetingData = {
        user_id: user.id,
        gcal_event_id: event.id,
        title: event.title,
        start_time: event.startTime,
        end_time: event.endTime,
        is_transcription_enabled: isEnabled,
        meeting_url: meetingUrl,
        platform,
        recall_bot_id: recallBotId,
        status,
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
        .from('meetings')
        .upsert(meetingData, { onConflict: 'user_id, gcal_event_id' });

    if (error) {
        console.error("Error toggling transcription:", error);
        throw new Error("Failed to update meeting setting.");
    }

    revalidatePath('/dashboard');
}

export async function postToLinkedIn(content: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'User not authenticated.' };
    }

    if (!content || content.trim().length === 0) {
        return { error: 'Content cannot be empty.' };
    }

    const { data: account, error: accountError } = await supabase
        .from('connected_accounts')
        .select('access_token, provider_user_id, expires_at')
        .eq('user_id', user.id)
        .eq('provider', 'linkedin')
        .single();

    if (accountError || !account) {
        return { error: 'LinkedIn account not connected.' };
    }

    if (account.expires_at && new Date(account.expires_at) < new Date()) {
        return { error: 'LinkedIn token has expired. Please reconnect your account.' };
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
            
            if (postResponse.status === 401) {
                return { error: 'LinkedIn token expired. Please reconnect your account.' };
            } else if (postResponse.status === 403) {
                return { error: 'Insufficient permissions to post on LinkedIn.' };
            } else if (postResponse.status === 429) {
                return { error: 'Rate limited by LinkedIn. Please try again later.' };
            }
            
            throw new Error(errorData.message || `LinkedIn API error: ${postResponse.status}`);
        }

        const responseData = await postResponse.json();
        console.log("Successfully posted to LinkedIn:", responseData);
        return { success: true, postId: responseData.id };

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Error posting to LinkedIn:", message);
        return { error: message };
    }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect('/auth/login');
}

const AutomationSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().min(3, "Name must be at least 3 characters"),
  platform: z.string().min(1, "Platform is required"),
  prompt: z.string().min(10, "Description must be at least 10 characters"),
});

type FormState = {
  success?: boolean;
  error?: string;
  issues?: Record<string, string[] | undefined>;
} | null;

export async function saveAutomation(prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const validatedFields = AutomationSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    platform: formData.get('platform'),
    prompt: formData.get('prompt'),
  });
  
  if (!validatedFields.success) {
    return { error: "Invalid data", issues: validatedFields.error.flatten().fieldErrors };
  }

  const { id, ...dataToSave } = validatedFields.data;

  const { error } = await supabase
    .from('automations')
    .upsert({
      id: id || undefined,
      user_id: user.id,
      ...dataToSave
    });
  
  if (error) {
    return { error: `Database error: ${error.message}` };
  }

  revalidatePath('/settings');
  return { success: true };
}

export async function deleteAutomation(automationId: string) {
    const supabase = await createClient();
    const { error } = await supabase.from('automations').delete().eq('id', automationId);
    if (error) return { error: `Database error: ${error.message}` };

    revalidatePath('/settings');
    return { success: true };
}

export async function getMeetingDetails(meetingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', meetingId)
    .eq('user_id', user.id)
    .single();
  
  if (meetingError) throw new Error(`Meeting not found: ${meetingError.message}`);

  const { data: generatedContent, error: contentError } = await supabase
    .from('generated_content')
    .select('*, automations(name, platform)')
    .eq('meeting_id', meetingId);

  if (contentError) throw new Error(`Could not fetch content: ${contentError.message}`);

  const emailContent = generatedContent?.find(c => c.type === 'email');
  const socialPosts = generatedContent?.filter(c => c.type.startsWith('social_post'));

  return {
    meeting,
    emailContent,
    socialPosts
  };
}

export async function disconnectAccount(accountId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from('connected_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', user.id);
  
  if (error) {
    console.error("Error disconnecting account:", error);
    return { error: `Database error: ${error.message}` };
  }

  revalidatePath('/settings');
  return { success: true };
}