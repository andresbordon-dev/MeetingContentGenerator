// src/app/dashboard/event-list.tsx
'use client';

import { useState } from "react";
import { CalendarEvent, toggleMeetingTranscription } from "../actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from 'date-fns';

type EventWithToggle = CalendarEvent & { isTranscriptionEnabled: boolean };

export function EventList({ initialEvents }: { initialEvents: EventWithToggle[] }) {
  const [events, setEvents] = useState(initialEvents);

  const handleToggle = async (eventId: string, isEnabled: boolean) => {
    const eventToUpdate = events.find(e => e.id === eventId);
    if (!eventToUpdate) return;
    
    // Optimistically update the UI
    setEvents(currentEvents =>
      currentEvents.map(e =>
        e.id === eventId ? { ...e, isTranscriptionEnabled: isEnabled } : e
      )
    );

    try {
      await toggleMeetingTranscription(eventToUpdate, isEnabled);
    } catch (error) {
      console.error("Failed to toggle transcription:", error);
      // Revert UI on error
      setEvents(currentEvents =>
        currentEvents.map(e =>
          e.id === eventId ? { ...e, isTranscriptionEnabled: !isEnabled } : e
        )
      );
      // You could show a toast notification here
    }
  };
  
  if (events.length === 0) {
    return <p>No upcoming meetings found in your primary calendar.</p>
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <Card key={event.id}>
          <CardHeader>
              <div className="flex justify-between items-start">
                  <div>
                      <CardTitle>{event.title}</CardTitle>
                      <CardDescription>
                          {event.startTime && format(new Date(event.startTime), "eeee, MMM d, yyyy 'at' h:mm a")}
                      </CardDescription>
                  </div>
                  <div className="flex flex-col items-center space-y-1">
                      <Switch
                        checked={event.isTranscriptionEnabled}
                        onCheckedChange={(checked) => handleToggle(event.id, checked)}
                        id={`transcribe-${event.id}`}
                      />
                      <label htmlFor={`transcribe-${event.id}`} className="text-xs text-muted-foreground">
                        Record
                      </label>
                  </div>
              </div>
          </CardHeader>
          <CardContent>
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">Attendees:</p>
                <div className="flex -space-x-2">
                    {event.attendees?.slice(0, 5).map((attendee, index) => (
                      <Avatar key={index} className="w-8 h-8 border-2 border-background">
                          <AvatarFallback>{attendee.email.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    ))}
                    {event.attendees && event.attendees.length > 5 && (
                        <Avatar className="w-8 h-8 border-2 border-background">
                            <AvatarFallback>+{event.attendees.length - 5}</AvatarFallback>
                        </Avatar>
                    )}
                </div>
              </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}