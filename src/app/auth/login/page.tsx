'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Icons } from '@/components/icons' // We will create this next

export default function LoginPage() {
  const supabase = createClient()

  const handleLoginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        // We add this scope again to ensure we can get a refresh token
        // for offline access to the calendar later.
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        queryParams: {
          access_type: 'offline', // This is crucial to get a refresh token
          prompt: 'consent', // This forces the consent screen to appear every time, useful for testing and ensuring token refresh
        },
      },
    })
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-[350px]">
        <CardHeader className="text-center">
          <CardTitle>Welcome!</CardTitle>
          <CardDescription>
            Sign in to generate social content from your meetings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLoginWithGoogle}
          >
            <Icons.google className="w-4 h-4 mr-2" />
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}