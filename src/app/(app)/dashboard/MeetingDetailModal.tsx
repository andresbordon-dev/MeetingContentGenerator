// src/app/(app)/dashboard/MeetingDetailModal.tsx
'use client';

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getMeetingDetails, postToLinkedIn } from "@/app/actions";
import { toast } from "sonner";
import { Copy, Send, Loader2 } from "lucide-react";

type SocialPost = Awaited<ReturnType<typeof getMeetingDetails>>['socialPosts'][0];

export function MeetingDetailModal({ meetingId, open, onOpenChange }: { meetingId: string, open: boolean, onOpenChange: (open: boolean) => void }) {
  const [details, setDetails] = useState<Awaited<ReturnType<typeof getMeetingDetails>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    if (open && meetingId) {
      setIsLoading(true);
      getMeetingDetails(meetingId)
        .then(data => setDetails(data))
        .catch(err => toast.error(err.message))
        .finally(() => setIsLoading(false));
    }
  }, [open, meetingId]);

  const handleCopy = (text: string | null, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard!`);
  };

  const handlePost = async (post: SocialPost) => {
    if (!post?.content || !post.automations?.platform) return;
    
    setIsPosting(true);
    const toastId = toast.loading(`Posting to ${post.automations.platform}...`);
    
    let result;
    if (post.automations.platform === 'linkedin') {
        result = await postToLinkedIn(post.content);
    } else {
        result = { error: 'Platform not supported yet.' };
    }

    if (result.success) {
        toast.success("Successfully posted!", { id: toastId });
    } else {
        toast.error(`Failed to post: ${result.error}`, { id: toastId });
    }
    setIsPosting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Draft post</DialogTitle>
          <p className="text-sm text-muted-foreground">Generate a post based on insights from this meeting.</p>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue={details?.socialPosts?.[0]?.id || 'email'}>
            <TabsList>
              {details?.socialPosts?.map(post => (
                <TabsTrigger key={post.id} value={post.id}>
                  {post.automations?.name || 'Social Post'}
                </TabsTrigger>
              ))}
            </TabsList>
            {details?.socialPosts?.map(post => (
              <TabsContent key={post.id} value={post.id}>
                <div className="border rounded-md p-4 relative min-h-[150px] bg-muted/20">
                  <pre className="whitespace-pre-wrap font-sans text-sm">{post.content}</pre>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <Button variant="outline" onClick={() => handleCopy(post.content, post.automations?.name || 'Post')}>
                    <Copy className="mr-2 h-4 w-4" /> Copy
                  </Button>
                  <Button onClick={() => handlePost(post)} disabled={isPosting}>
                    {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                    Post
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
        <div className="mt-4">
          <Sheet>
              <SheetTrigger asChild>
                  <Button variant="link" className="p-0">View full transcript</Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                  <SheetHeader>
                      <SheetTitle>Meeting Transcript</SheetTitle>
                  </SheetHeader>
                  <p className="text-sm text-muted-foreground mt-4 whitespace-pre-wrap">{details?.meeting.transcript}</p>
              </SheetContent>
          </Sheet>
        </div>
      </DialogContent>
    </Dialog>
  );
}