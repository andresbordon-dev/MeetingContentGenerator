// src/app/meetings/[id]/meeting-detail-client.tsx
'use client';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { postToLinkedIn } from '@/app/actions';
import { Copy, Send } from "lucide-react";
import { toast } from "sonner";

// Define types based on our database schema
type Meeting = {
    id: string;
    transcript: string | null;
    // add other fields if needed
};

type SocialPost = {
    id: string;
    type: string;
    content: string | null;
};

interface MeetingDetailClientProps {
    meeting: Meeting;
    emailContent: string;
    socialPosts: SocialPost[];
}

// A small helper to format the platform name nicely
const formatPlatformName = (type: string) => {
    if (type.includes('linkedin')) return 'LinkedIn';
    if (type.includes('facebook')) return 'Facebook';
    return 'Social Post';
}

export function MeetingDetailClient({ meeting, emailContent, socialPosts }: MeetingDetailClientProps) {
    const [isPosting, setIsPosting] = useState(false);

    const handleCopy = (text: string, type: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success(`${type} copied to clipboard!`);
    };

    const handlePost = async (content: string | null, platform: string) => {
        if (!content) return;

        setIsPosting(true);
        const toastId = toast.loading(`Posting to ${platform}...`);

        let result;
        if (platform === 'LinkedIn') {
            result = await postToLinkedIn(content);
        } else {
            result = { error: 'This platform is not supported for posting yet.' };
        }

        if (result.success) {
            toast.success(`Successfully posted to ${platform}!`, { id: toastId });
        } else {
            toast.error(`Failed to post: ${result.error}`, { id: toastId });
        }
        setIsPosting(false);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <Tabs defaultValue="social">
                    <TabsList className="mb-4">
                        <TabsTrigger value="social">Social Media Posts</TabsTrigger>
                        <TabsTrigger value="email">Follow-up Email</TabsTrigger>
                    </TabsList>

                    <TabsContent value="social">
                        <Tabs defaultValue={socialPosts[0]?.type || 'none'}>
                            <TabsList>
                                {socialPosts.map(post => (
                                    <TabsTrigger key={post.id} value={post.type}>
                                        {formatPlatformName(post.type)}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            {socialPosts.map(post => (
                                <TabsContent key={post.id} value={post.type} className="mt-4">
                                    <div className="prose bg-muted rounded-md p-4 relative">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-2 right-2 h-7 w-7"
                                            onClick={() => handleCopy(post.content || '', formatPlatformName(post.type))}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                        <pre className="bg-transparent p-0 whitespace-pre-wrap font-sans text-sm">{post.content}</pre>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <div className="mt-4 flex justify-end">
                                            <Button
                                                onClick={() => handlePost(post.content, formatPlatformName(post.type))}
                                                disabled={isPosting || formatPlatformName(post.type) !== 'LinkedIn'}
                                            >
                                                {isPosting ? 'Posting...' : <><Send className="h-4 w-4 mr-2" /> Post to {formatPlatformName(post.type)}</>}
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>
                            ))}
                        </Tabs>
                    </TabsContent>

                    <TabsContent value="email">
                        <div className="prose bg-muted rounded-md p-4 relative">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 h-7 w-7"
                                onClick={() => handleCopy(emailContent, 'Email content')}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                            <pre className="bg-transparent p-0 whitespace-pre-wrap font-sans text-sm">{emailContent}</pre>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            <div>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline">View Full Transcript</Button>
                    </SheetTrigger>
                    <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>Meeting Transcript</SheetTitle>
                            <SheetDescription>
                                Full transcript of the meeting provided by Recall.ai.
                            </SheetDescription>
                        </SheetHeader>
                        <div className="mt-4 prose prose-sm max-w-none">
                            <p>{meeting.transcript || "Transcript not available."}</p>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}