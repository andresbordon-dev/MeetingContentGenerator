// src/app/meetings/[id]/page.tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { MeetingDetailClient } from "./meeting-detail-client";

type MeetingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MeetingDetailPage({ params }: MeetingDetailPageProps) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single();
    
  if (!meeting) {
    notFound();
  }

  const { data: generatedContent } = await supabase
    .from('generated_content')
    .select('*')
    .eq('meeting_id', id);

  // Organize content by type for easy access in the client component
  const emailContent = generatedContent?.find(c => c.type === 'email')?.content || "";
  const socialPosts = generatedContent?.filter(c => c.type.startsWith('social_post')) || [];
  
  return (
    <div>
      <div className="mb-6">
          <h1 className="text-3xl font-bold">{meeting.title}</h1>
          <p className="text-muted-foreground">
              {format(new Date(meeting.start_time), "eeee, MMM d, yyyy 'at' h:mm a")}
          </p>
      </div>
      
      <MeetingDetailClient 
        meeting={meeting} 
        emailContent={emailContent} 
        socialPosts={socialPosts} 
      />
    </div>
  );
}