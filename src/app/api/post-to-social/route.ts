// src/app/api/post-to-social/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { content, platform } = await request.json();

    if (!content || !platform) {
        return NextResponse.json({ error: 'Missing content or platform' }, { status: 400 });
    }

    if (platform === 'linkedin') {
        // 1. Get the user's LinkedIn token from our database
        const { data: account, error: accountError } = await supabase
            .from('connected_accounts')
            .select('access_token, provider_user_id')
            .eq('user_id', user.id)
            .eq('provider', 'linkedin')
            .single();

        if (accountError || !account) {
            return NextResponse.json({ error: 'LinkedIn account not connected or found.' }, { status: 404 });
        }

        try {
            // 2. Make the API call to LinkedIn's UGC Posts API
            const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${account.access_token}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0'
                },
                body: JSON.stringify({
                    author: `urn:li:person:${account.provider_user_id}`,
                    lifecycleState: 'PUBLISHED',
                    specificContent: {
                        'com.linkedin.ugc.ShareContent': {
                            shareCommentary: {
                                text: content
                            },
                            shareMediaCategory: 'NONE'
                        }
                    },
                    visibility: {
                        'com.linkedin.ugc.MemberNetworkVisibility': 'CONNECTIONS'
                    }
                })
            });

            if (!postResponse.ok) {
                const errorData = await postResponse.json();
                console.error("LinkedIn API Error:", errorData);
                throw new Error(errorData.message || 'Failed to post to LinkedIn.');
            }
            
            const responseData = await postResponse.json();
            console.log("Successfully posted to LinkedIn:", responseData);
            return NextResponse.json({ success: true, postId: responseData.id });

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return NextResponse.json({ error: message }, { status: 500 });
        }
    }

    return NextResponse.json({ error: 'Platform not supported yet.' }, { status: 400 });
}