import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateFollowUpEmail(transcript: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert assistant for financial advisors. Your task is to draft a concise, professional follow-up email based on a meeting transcript. The email should summarize key discussion points, list clear action items (for both the advisor and the client), and end with a positive closing statement. Format it as a ready-to-send email.",
        },
        {
          role: "user",
          content: `Here is the meeting transcript:\n\n${transcript}`,
        },
      ],
    });
    return completion.choices[0].message.content || "Could not generate email content.";
  } catch (error) {
    console.error("Error generating follow-up email:", error);
    return "Error: Could not generate email content.";
  }
}

async function generateSocialMediaPost(transcript: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a social media marketing expert for financial advisors. Based on a meeting transcript, generate an engaging LinkedIn post that shares a valuable, anonymous insight or tip without revealing any client-specific or confidential information. The post should be educational, build authority, and include relevant hashtags.",
        },
        {
          role: "user",
          content: `Here is the meeting transcript:\n\n${transcript}`,
        },
      ],
    });
    return completion.choices[0].message.content || "Could not generate social media post.";
  } catch (error) {
    console.error("Error generating social media post:", error);
    return "Error: Could not generate social media post.";
  }
}

interface RecallBotResponse {
  state: string;
  transcript_url?: string;
}

interface TranscriptItem {
  text?: string;
  [key: string]: unknown;
}

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

  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('status', 'scheduled')
    .lte('end_time', new Date().toISOString());

  if (error) {
    console.error("Error fetching scheduled meetings:", error);
    return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 });
  }

  if (!meetings || meetings.length === 0) {
    return NextResponse.json({ message: "No meetings to process at this time." });
  }

  let processedCount = 0;
  let errorCount = 0;

  for (const meeting of meetings) {
    if (!meeting.recall_bot_id) {
      console.warn(`Meeting ${meeting.id} has no recall_bot_id, skipping`);
      continue;
    }

    try {
      let response;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          response = await fetch(`https://api.recall.ai/api/v1/bots/${meeting.recall_bot_id}/`, {
            method: 'GET',
            headers: { 'Authorization': `Token ${recallApiKey}` },
          });

          if (response.ok) break;
          
          if (response.status === 429) {
            const waitTime = Math.pow(2, retryCount) * 1000;
            console.log(`Rate limited, waiting ${waitTime}ms before retry ${retryCount + 1}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retryCount++;
            continue;
          }

          throw new Error(`Recall API responded with status ${response.status}`);
        } catch (fetchError) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw fetchError;
          }
          console.warn(`Fetch attempt ${retryCount} failed for meeting ${meeting.id}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (!response || !response.ok) {
        throw new Error(`Failed to fetch bot status after ${maxRetries} attempts`);
      }

      const botData: RecallBotResponse = await response.json();

      if (botData.state === 'media_ready' && botData.transcript_url) {
        console.log(`Transcript ready for meeting ${meeting.id}. Processing...`);

        const transcriptResponse = await fetch(botData.transcript_url);
        const transcriptData: TranscriptItem[] | unknown = await transcriptResponse.json();

        const transcriptText = Array.isArray(transcriptData)
          ? transcriptData.map(t => t?.text || '').join(' ')
          : '';

        if (!transcriptText) {
          throw new Error("Transcript text is empty.");
        }

        const { data: automations, error: autoError } = await supabase
          .from('automations')
          .select('*')
          .eq('user_id', meeting.user_id);

        if (autoError) throw new Error(`Could not fetch automations: ${autoError.message}`);

        if (automations && automations.length > 0) {
          await Promise.all(automations.map(async (automation) => {
            try {
              const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                  { role: "system", content: automation.prompt },
                  { role: "user", content: `Here is the meeting transcript:\n\n${transcriptText}` }
                ]
              });
              const content = completion.choices[0].message.content;

              if (content) {
                await supabase.from('generated_content').upsert({
                  meeting_id: meeting.id,
                  automation_id: automation.id,
                  type: `social_post_${automation.platform}`,
                  content: content
                }, { onConflict: 'meeting_id, automation_id' });
              }
            } catch (autoError) {
              console.error(`Failed to generate content for automation ${automation.id}:`, autoError);
            }
          }));
        }

        const emailContent = await generateFollowUpEmail(transcriptText);
        if (emailContent) {
          await supabase.from('generated_content').upsert({
            meeting_id: meeting.id,
            type: 'email',
            content: emailContent
          }, { onConflict: 'meeting_id, type' });
        }

        const { error: updateError } = await supabase.from('meetings').update({
          status: 'completed',
          transcript: transcriptText,
        }).eq('id', meeting.id);

        if (updateError) {
          console.error(`Failed to update meeting ${meeting.id}:`, updateError);
          throw updateError;
        }

        console.log(`Successfully processed and generated content for meeting ${meeting.id}`);
        processedCount++;
      } else if (['error', 'done'].includes(botData.state)) {
        await supabase.from('meetings').update({ status: 'error' }).eq('id', meeting.id);
        console.log(`Bot for meeting ${meeting.id} ended in state: ${botData.state}`);
      }
    } catch (processError) {
      console.error(`Failed to process meeting ${meeting.id}:`, processError);
      errorCount++;
      
      try {
        await supabase.from('meetings').update({ 
          status: 'error',
          error_message: processError instanceof Error ? processError.message : 'Unknown error'
        }).eq('id', meeting.id);
      } catch (updateError) {
        console.error(`Failed to update meeting ${meeting.id} status to error:`, updateError);
      }
    }
  }

  return NextResponse.json({ 
    message: `Processing completed. Processed: ${processedCount}, Errors: ${errorCount}`,
    processed: processedCount,
    errors: errorCount
  });
}