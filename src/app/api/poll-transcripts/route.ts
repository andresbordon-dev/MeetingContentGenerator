// src/app/api/poll-transcripts/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- AI Generation Functions ---

async function generateFollowUpEmail(transcript: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Use gpt-4 for higher quality if budget allows
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

// This is a placeholder for social media generation. In a real app, this would
// iterate through user's custom automations. For now, we'll use a fixed one.
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


// --- MAIN API ROUTE ---

export async function GET(request: Request) {
  // 1. Secure the endpoint
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

  // 2. Find meetings that have finished and are waiting for a transcript
  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('status', 'scheduled')
    .lte('end_time', new Date().toISOString()); // Check for meetings whose end time is in the past

  if (error) {
    console.error("Error fetching scheduled meetings:", error);
    return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 });
  }

  if (!meetings || meetings.length === 0) {
    return NextResponse.json({ message: "No meetings to process at this time." });
  }

  let processedCount = 0;
  for (const meeting of meetings) {
    if (!meeting.recall_bot_id) continue;

    try {
      // 3. Poll Recall.ai for the bot's status
      const response = await fetch(`https://api.recall.ai/api/v1/bots/${meeting.recall_bot_id}/`, {
        method: 'GET',
        headers: { 'Authorization': `Token ${recallApiKey}` },
      });

      if (!response.ok) {
        throw new Error(`Recall API responded with status ${response.status}`);
      }

      const botData = await response.json();

      // 4. If transcript is ready, process it
      if (botData.state === 'media_ready' && botData.transcript_url) {
        console.log(`Transcript ready for meeting ${meeting.id}. Processing...`);

        const transcriptResponse = await fetch(botData.transcript_url);
        const transcriptData = await transcriptResponse.json();
        const transcriptText = transcriptData.map((t: any) => t.text).join(' ');

        if (!transcriptText) {
            throw new Error("Transcript text is empty.");
        }

        // --- Trigger AI Content Generation ---
        const [emailContent, socialPostContent] = await Promise.all([
            generateFollowUpEmail(transcriptText),
            generateSocialMediaPost(transcriptText)
        ]);

        // --- Save everything to the database ---
        const { error: updateError } = await supabase.from('meetings').update({
            status: 'completed',
            transcript: transcriptText,
        }).eq('id', meeting.id);

        if (updateError) throw updateError;
        
        // For now, we save these with a fixed type. Later, this would link to the user's specific automations.
        // Using `upsert` is a good practice here in case the job runs twice.
        const { error: contentError } = await supabase.from('generated_content').upsert([
            { meeting_id: meeting.id, type: 'email', content: emailContent },
            { meeting_id: meeting.id, type: 'social_post_linkedin', content: socialPostContent }
        ], { onConflict: 'meeting_id, type' });

        if (contentError) throw contentError;

        console.log(`Successfully processed and generated content for meeting ${meeting.id}`);
        processedCount++;
      } else if (['error', 'done'].includes(botData.state)) {
        // Handle terminal states where media isn't ready
        await supabase.from('meetings').update({ status: 'error' }).eq('id', meeting.id);
        console.log(`Bot for meeting ${meeting.id} ended in state: ${botData.state}`);
      }
    } catch (processError) {
      console.error(`Failed to process meeting ${meeting.id}:`, processError);
      await supabase.from('meetings').update({ status: 'error' }).eq('id', meeting.id);
    }
  }

  return NextResponse.json({ message: `Processed ${processedCount} meetings.` });
}