// src/app/(app)/dashboard/dashboard-client.tsx
'use client';

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { CheckCircle, Clock, AlertTriangle, CalendarPlus } from 'lucide-react';
import { toggleMeetingTranscription, AccountWithEvents, CalendarEvent } from "@/app/actions";
import { Icons } from "@/components/icons";
import { MeetingDetailModal } from "./MeetingDetailModal";

// This type is now used by both server and client components
export type MeetingTileInfo = {
    id: string;
    title: string;
    startTime: string;
    isUpcoming: boolean;
    status?: 'completed' | 'processing' | 'error' | 'pending';
    gcalEventId?: string;
};

const statusIcons = {
    completed: <CheckCircle className="h-5 w-5 text-green-500" />,
    processing: <Clock className="h-5 w-5 text-yellow-500" />,
    error: <AlertTriangle className="h-5 w-5 text-red-500" />,
};

// Meeting Tile component remains the same
function MeetingTile({ meeting, isEnabled, onToggle, onClick }: {
    meeting: MeetingTileInfo,
    isEnabled?: boolean,
    onToggle?: (isEnabled: boolean) => void,
    onClick?: () => void
}) {
    const cardClasses = "h-full transition-shadow";
    const clickableClasses = onClick ? "cursor-pointer hover:shadow-md" : "";
    const cardContent = (
        <div onClick={onClick} className={`${cardClasses} ${clickableClasses}`}>
            <Card className="h-full">
                <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                        <CardTitle className="text-base line-clamp-2">{meeting.title}</CardTitle>
                        {meeting.isUpcoming && onToggle && (
                            <div className="flex flex-col items-center space-y-1">
                                <Switch checked={isEnabled} onCheckedChange={onToggle} />
                                <label className="text-xs text-muted-foreground">Record</label>
                            </div>
                        )}
                        {!meeting.isUpcoming && meeting.status && (
                            statusIcons[meeting.status as keyof typeof statusIcons]
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        {format(new Date(meeting.startTime), "eee, MMM d, 'at' h:mm a")}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
    if (!meeting.isUpcoming) {
        return <Link href={`/meetings/${meeting.id}`}>{cardContent}</Link>;
    }
    return cardContent;
}

export function DashboardClient({ accountsWithEvents, pastMeetings, initialEnabledIds }: {
    accountsWithEvents: AccountWithEvents[],
    pastMeetings: MeetingTileInfo[],
    initialEnabledIds: (string | null)[]
}) {
    const [enabledIds, setEnabledIds] = useState(new Set(initialEnabledIds));
    const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

    const handleToggle = async (event: CalendarEvent, isEnabled: boolean) => {
        setEnabledIds(prev => {
            const newSet = new Set(prev);
            if (isEnabled) newSet.add(event.id); else newSet.delete(event.id);
            return newSet;
        });

        try {
            await toggleMeetingTranscription(event, isEnabled);
        } catch (error) {
            console.error("Failed to toggle transcription:", error);
            setEnabledIds(prev => {
                const newSet = new Set(prev);
                if (isEnabled) newSet.delete(event.id); else newSet.add(event.id);
                return newSet;
            });
        }
    };

    return (
        <>
            <Tabs defaultValue="upcoming">
                <TabsList className="mb-4">
                    <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                    <TabsTrigger value="past">Past</TabsTrigger>
                </TabsList>

                <TabsContent value="upcoming">
                    {accountsWithEvents.length > 0 ? (
                        <div className="space-y-8">
                            {accountsWithEvents.map(account => (
                                <section key={account.accountEmail}>
                                    <div className="flex items-center space-x-2 mb-4">
                                        <Icons.google className="h-5 w-5" />
                                        <h2 className="text-lg font-semibold">{account.accountEmail}</h2>
                                    </div>
                                    {account.events.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {account.events.map(event => (
                                                <MeetingTile
                                                    key={event.id}
                                                    meeting={{
                                                        id: event.id,
                                                        gcalEventId: event.id,
                                                        title: event.title || "Untitled Meeting",
                                                        startTime: event.startTime || new Date().toISOString(),
                                                        isUpcoming: true
                                                    }}
                                                    isEnabled={enabledIds.has(event.id)}
                                                    onToggle={(checked) => handleToggle(event, checked)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground pl-2">No upcoming meetings for this account.</p>
                                    )}
                                </section>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <CalendarPlus className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-2 text-sm font-semibold">No connected accounts</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Connect a Google Account in Settings to see your meetings.</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="past">
                    {pastMeetings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {pastMeetings.map(meeting => (
                                <MeetingTile
                                    key={meeting.id}
                                    meeting={meeting}
                                    // --- ADD ONCLICK HANDLER ---
                                    onClick={() => setSelectedMeetingId(meeting.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <h3 className="mt-2 text-sm font-semibold">No past meetings recorded</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Enable recording for an upcoming meeting to get started.</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {selectedMeetingId && (
                <MeetingDetailModal
                    meetingId={selectedMeetingId}
                    open={!!selectedMeetingId}
                    onOpenChange={(isOpen) => {
                        if (!isOpen) {
                            setSelectedMeetingId(null);
                        }
                    }}
                />
            )}
        </>
    );
}