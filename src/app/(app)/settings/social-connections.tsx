// src/app/settings/social-connections.tsx
'use client';

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";

// This component will be more dynamic later, but for now it's simple.
const LinkedInIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect width="4" height="12" x="2" y="9"></rect><circle cx="4" cy="4" r="2"></circle></svg>
);

export function SocialConnections({ serverConnectedProviders }: { serverConnectedProviders: string[] }) {
  const isLinkedInConnected = serverConnectedProviders.includes('linkedin');
  
  const handleConnectLinkedIn = () => {
    const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/callback/linkedin`;
    const scope = 'openid profile w_member_social'; // profile for name, w_member_social for posting
    const state = 'DCEeFWf45A53sdfKef424'; // A unique, unguessable random string.

    const oauthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;

    window.location.href = oauthUrl;
  };

  const handleConnectGoogle = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    // This is our new, dedicated callback route
    const redirectUri = `${window.location.origin}/auth/callback/google-additional`;
    const scope = 'https://www.googleapis.com/auth/calendar.readonly openid email profile';
    
    // The 'prompt' parameter is crucial. 'select_account' forces the user to
    // choose which Google account to connect, even if they are already logged in to one.
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` + // Ensures we get a refresh token
      `&prompt=consent select_account`;

    window.location.href = oauthUrl;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 border rounded-md">
        <div className="flex items-center">
          <Icons.google className="mr-2 h-4 w-4" />
          <span className="font-medium">Google Calendar</span>
        </div>
        {/* The primary account is connected via login, so this adds more */}
        <Button onClick={handleConnectGoogle} variant="outline">
          Connect another account
        </Button>
      </div>

      <div className="flex items-center justify-between p-4 border rounded-md">
        <div className="flex items-center">
          <LinkedInIcon />
          <span className="font-medium">LinkedIn</span>
        </div>
        {isLinkedInConnected ? (
          <Button variant="outline" disabled>Connected</Button>
        ) : (
          <Button onClick={handleConnectLinkedIn}>Connect</Button>
        )}
      </div>
    </div>
  );
}