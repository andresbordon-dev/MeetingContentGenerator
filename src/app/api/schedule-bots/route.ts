// src/app/api/schedule-bots/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET(request: Request) {
  // Secure the endpoint with a cron secret if deploying to production
  // For this challenge, we'll keep it simple.
  // const headersList = headers();
  // const cronSecret = headersList.get('authorization');
  // if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new NextResponse('Unauthorized', { status: 401 });
  // }

  const supabase = await createClient();

  // Find meetings that are enabled, haven't been scheduled yet,
  // and are starting in the next 15 minutes.
  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
  
  const { data: meetingsToSchedule, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('is_transcription_enabled', true)
    .eq('status', 'pending')
    .lte('start_time', fifteenMinutesFromNow.toISOString())
    .gte('start_time', now.toISOString());

  if (error) {
    console.error("Error fetching meetings to schedule:", error);
    return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 });
  }

  if (!meetingsToSchedule || meetingsToSchedule.length === 0) {
    return NextResponse.json({ message: "No meetings to schedule at this time." });
  }

  const recallApiKey = process.env.RECALL_API_KEY;
  if (!recallApiKey) {
    console.error("RECALL_API_KEY is not set.");
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  let scheduledCount = 0;
  for (const meeting of meetingsToSchedule) {
    if (!meeting.meeting_url) {
      // Update status to error if no meeting URL was found
      await supabase.from('meetings').update({ status: 'error' }).eq('id', meeting.id);
      continue;
    }

    try {
      const response = await fetch('https://api.recall.ai/api/v1/bots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${recallApiKey}`,
        },
        body: JSON.stringify({
          meeting_url: meeting.meeting_url,
          // Hardcoding join time for now. This will come from settings later.
          join_at: meeting.start_time,
          bot_name: "ContentGen Bot",
          transcription_options: {
              provider: "deepgram"
          }
        }),
      });
      
      const botData = await response.json();

      if (!response.ok) {
        throw new Error(botData.detail || 'Failed to schedule bot');
      }

      // IMPORTANT: Update our database with the bot ID and new status
      await supabase
        .from('meetings')
        .update({
          recall_bot_id: botData.id,
          status: 'scheduled',
        })
        .eq('id', meeting.id);

      scheduledCount++;
      console.log(`Successfully scheduled bot ${botData.id} for meeting ${meeting.id}`);

    } catch (scheduleError) {
      console.error(`Failed to schedule bot for meeting ${meeting.id}:`, scheduleError);
      await supabase.from('meetings').update({ status: 'error' }).eq('id', meeting.id);
    }
  }

  return NextResponse.json({ message: `Scheduled ${scheduledCount} bots successfully.` });
}