// src/app/(app)/dashboard/event-dashboard-client.tsx
'use client';

import { useState } from "react";
import { CalendarEvent, toggleMeetingTranscription, AccountWithEvents } from "@/app/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from 'date-fns';
import { Icons } from "@/components/icons";

// A single event card component
function EventCard({ event, isEnabled, onToggle }: { event: CalendarEvent, isEnabled: boolean, onToggle: (isEnabled: boolean) => void }) {
    return (
        <Card className="mb-4">
            <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-semibold">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                            {event.startTime && format(new Date(event.startTime), "eeee, MMM d 'at' h:mm a")}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                            <div className="flex -space-x-2">
                                {event.attendees?.slice(0, 3).map((attendee, index) => (
                                    <Avatar key={index} className="w-6 h-6 border-2 border-background text-xs">
                                        <AvatarFallback>{attendee.email.substring(0, 1).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                ))}
                                {event.attendees && event.attendees.length > 3 && (
                                    <Avatar className="w-6 h-6 border-2 border-background text-xs">
                                        <AvatarFallback>+{event.attendees.length - 3}</AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-center space-y-1 pl-4">
                        <Switch
                            checked={isEnabled}
                            onCheckedChange={onToggle}
                            id={`transcribe-${event.id}`}
                        />
                        <label htmlFor={`transcribe-${event.id}`} className="text-xs text-muted-foreground">
                            Record
                        </label>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}


export function EventDashboardClient({ initialAccounts, initialEnabledIds }: { initialAccounts: AccountWithEvents[], initialEnabledIds: string[] }) {
  const [enabledIds, setEnabledIds] = useState(new Set(initialEnabledIds));

  const handleToggle = async (event: CalendarEvent, isEnabled: boolean) => {
    // Optimistic UI update
    setEnabledIds(prev => {
        const newSet = new Set(prev);
        if (isEnabled) {
            newSet.add(event.id);
        } else {
            newSet.delete(event.id);
        }
        return newSet;
    });

    try {
      await toggleMeetingTranscription(event, isEnabled);
    } catch (error) {
      console.error("Failed to toggle transcription:", error);
      // Revert UI on error
      setEnabledIds(prev => {
        const newSet = new Set(prev);
        if (isEnabled) {
            newSet.delete(event.id);
        } else {
            newSet.add(event.id);
        }
        return newSet;
      });
    }
  };
  
  if (initialAccounts.length === 0) {
    return <p>No Google accounts connected. Please connect one in settings.</p>
  }

  return (
    <Accordion type="multiple" defaultValue={initialAccounts.map(a => a.accountEmail)} className="w-full">
        {initialAccounts.map(({ accountEmail, events }) => (
            <AccordionItem value={accountEmail} key={accountEmail}>
                <AccordionTrigger>
                    <div className="flex items-center space-x-2">
                        <Icons.google className="h-4 w-4" />
                        <span className="font-medium">{accountEmail}</span>
                        <span className="text-sm text-muted-foreground">({events.length} upcoming meetings)</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    {events.length > 0 ? (
                        events.map(event => (
                            <EventCard 
                                key={event.id} 
                                event={event} 
                                isEnabled={enabledIds.has(event.id)}
                                onToggle={(checked) => handleToggle(event, checked)}
                            />
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground px-4 py-2">No upcoming meetings found for this account in the next 30 days.</p>
                    )}
                </AccordionContent>
            </AccordionItem>
        ))}
    </Accordion>
  );
}