// src/app/api/auth/callback/linkedin/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // const state = searchParams.get('state'); // You should validate the state here in a real app

  if (!code) {
    return NextResponse.redirect(`${origin}/settings?error=linkedin_missing_code`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login?error=not_authenticated`);
  }

  try {
    // 1. Exchange authorization code for an access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${origin}/api/auth/callback/linkedin`,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(errorData.error_description || "Failed to get LinkedIn token.");
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;

    // 2. Use the access token to get the user's LinkedIn profile (to get their ID)
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!profileResponse.ok) throw new Error("Failed to fetch LinkedIn user profile.");

    const profileData = await profileResponse.json();
    const linkedInUserId = profileData.sub; // 'sub' is the standard field for the user's unique ID

    // 3. Save the tokens and user ID to your database
    const { error: upsertError } = await supabase
      .from('connected_accounts')
      .upsert({
        user_id: user.id,
        provider: 'linkedin',
        provider_user_id: linkedInUserId,
        access_token: accessToken,
        // LinkedIn refresh tokens are longer-lived, handle separately if needed
        // refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      }, { onConflict: 'user_id, provider' });
      
    if (upsertError) throw upsertError;

    return NextResponse.redirect(`${origin}/settings?success=linkedin_connected`);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("LinkedIn OAuth Error:", message);
    return NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(message)}`);
  }
}