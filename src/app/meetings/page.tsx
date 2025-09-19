// src/app/meetings/page.tsx
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { format } from 'date-fns';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';

const statusIcons = {
  completed: <CheckCircle className="h-5 w-5 text-green-500" />,
  processing: <Clock className="h-5 w-5 text-yellow-500" />,
  error: <AlertTriangle className="h-5 w-5 text-red-500" />,
};

export default async function PastMeetingsPage() {
  const supabase = await createClient();
  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('*')
    .in('status', ['completed', 'processing', 'error'])
    .order('start_time', { ascending: false });

  if (error) {
    return <p>Could not load past meetings.</p>;
  }

  if (meetings.length === 0) {
    return <p>No past meetings found.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Past Meetings</h1>
      <div className="space-y-4">
        {meetings.map((meeting) => (
          <Link href={`/meetings/${meeting.id}`} key={meeting.id}>
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{meeting.title || 'Untitled Meeting'}</CardTitle>
                  <CardDescription>
                    {format(new Date(meeting.start_time), "eeee, MMM d, yyyy 'at' h:mm a")}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm capitalize text-muted-foreground">{meeting.status}</span>
                  {statusIcons[meeting.status as keyof typeof statusIcons]}
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}