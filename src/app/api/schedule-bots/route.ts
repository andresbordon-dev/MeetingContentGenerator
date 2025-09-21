import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET(_request: Request) {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = await createClient();
  const recallApiKey = process.env.RECALL_API_KEY;

  if (!recallApiKey) {
    console.error("RECALL_API_KEY is not set.");
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('is_transcription_enabled', true)
      .is('recall_bot_id', null)
      .gte('start_time', new Date().toISOString());

    if (error) {
      console.error("Error fetching meetings:", error);
      return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 });
    }

    if (!meetings || meetings.length === 0) {
      return NextResponse.json({ message: "No meetings need bots created at this time." });
    }

    let createdCount = 0;
    let errorCount = 0;

    for (const meeting of meetings) {
      try {
        console.log(`Creating bot for meeting ${meeting.id}: ${meeting.title}`);
        
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
          console.error(`Failed to create bot for meeting ${meeting.id}:`, errorData);
          errorCount++;
          continue;
        }

        const botData = await botResponse.json();
        
        const { error: updateError } = await supabase
          .from('meetings')
          .update({ 
            recall_bot_id: botData.id,
            status: 'scheduled'
          })
          .eq('id', meeting.id);

        if (updateError) {
          console.error(`Failed to update meeting ${meeting.id} with bot ID:`, updateError);
          errorCount++;
        } else {
          console.log(`Successfully created bot ${botData.id} for meeting ${meeting.id}`);
          createdCount++;
        }

      } catch (error) {
        console.error(`Error processing meeting ${meeting.id}:`, error);
        errorCount++;
      }
    }

    return NextResponse.json({ 
      message: `Bot creation completed. Created: ${createdCount}, Errors: ${errorCount}`,
      created: createdCount,
      errors: errorCount
    });

  } catch (error) {
    console.error("Unexpected error in schedule-bots:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}