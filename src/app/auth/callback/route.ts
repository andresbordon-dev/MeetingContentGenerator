// src/app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard' // Redirect to dashboard now

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      const { user, session } = data
      // Save the provider token to our custom table
      // This is crucial for making API calls on the user's behalf
      if (session.provider_token && session.provider_refresh_token) {
        const { error: insertError } = await supabase
          .from('connected_accounts')
          .upsert({
            user_id: user.id,
            provider: 'google',
            provider_user_id: user.user_metadata.provider_id,
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token,
            expires_at: new Date(session.expires_at! * 1000).toISOString(),
            provider_user_email: user.email,
          }, { onConflict: 'user_id, provider, provider_user_id' }) // Use upsert to handle re-logins

        if (insertError) {
          console.error("Error saving provider token:", insertError);
          // Redirect to an error page or show a message
          return NextResponse.redirect(`${origin}/auth/login?error=Failed to save account connection.`);
        }
      }
      
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=Could not authenticate user`)
}