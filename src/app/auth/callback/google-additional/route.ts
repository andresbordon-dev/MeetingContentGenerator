// src/app/api/auth/callback/google-additional/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/settings?error=google_missing_code`);
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login?error=not_authenticated`);
  }

  try {
    // 1. Exchange authorization code for an access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/auth/callback/google-additional`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(errorData.error_description || "Failed to get Google token.");
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token; // We get this because of `access_type=offline`
    const expiresIn = tokenData.expires_in;

    // 2. Use the access token to get the new account's user info (to get their unique ID)
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!profileResponse.ok) throw new Error("Failed to fetch Google user profile.");

    const profileData = await profileResponse.json();
    const googleUserId = profileData.id;

    // 3. Save the new connection to your database
    const { error: upsertError } = await supabase
      .from('connected_accounts')
      .upsert({
        user_id: user.id,
        provider: 'google',
        provider_user_id: googleUserId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      }, { onConflict: 'user_id, provider, provider_user_id' }); // onConflict is key to prevent duplicates
      
    if (upsertError) {
        console.error("Supabase upsert error:", upsertError);
        throw upsertError;
    }

    return NextResponse.redirect(`${origin}/settings?success=google_connected`);

  } catch (error: any) {
    console.error("Google OAuth Callback Error:", error.message);
    return NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(error.message)}`);
  }
}