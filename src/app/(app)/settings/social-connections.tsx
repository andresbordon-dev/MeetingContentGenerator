// src/app/(app)/settings/social-connections.tsx
'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { disconnectAccount } from "../../actions";
import { toast } from "sonner";
import { PlusCircle, Trash2 } from "lucide-react";

type Connection = {
  id: string;
  provider: string;
  provider_user_email: string | null;
};

const LinkedInIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect width="4" height="12" x="2" y="9"></rect><circle cx="4" cy="4" r="2"></circle></svg>
);

export function SocialConnections({ initialConnections }: { initialConnections: Connection[] }) {
  // Use state to manage connections for optimistic UI updates
  const [connections, setConnections] = useState(initialConnections);

  // --- OAUTH CONNECTION HANDLERS ---
  const handleConnectGoogle = () => { /* ... (same as before) ... */ };
  const handleConnectLinkedIn = () => { /* ... (same as before) ... */ };

  // --- DISCONNECT HANDLER ---
  const handleDisconnect = async (account: Connection) => {
    if (confirm(`Are you sure you want to disconnect ${account.provider_user_email || account.provider}?`)) {
      // Optimistic UI update: remove the account from the list immediately
      setConnections(prev => prev.filter(c => c.id !== account.id));
      
      const result = await disconnectAccount(account.id);
      
      if (result.success) {
        toast.success("Account disconnected successfully.");
      } else {
        toast.error(`Failed to disconnect: ${result.error}`);
        // Revert UI on error
        setConnections(initialConnections);
      }
    }
  };

  // Filter connections for easier rendering
  const googleAccounts = connections.filter(c => c.provider === 'google');
  const linkedInConnection = connections.find(c => c.provider === 'linkedin');

  return (
    <div className="space-y-6">
      {/* --- GOOGLE ACCOUNTS SECTION --- */}
      <div>
        <h3 className="font-semibold mb-2">Google Accounts</h3>
        <div className="space-y-2">
          {googleAccounts.map(account => (
            <div key={account.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
              <div className="flex items-center gap-2">
                <Icons.google className="h-4 w-4" />
                <span className="text-sm font-medium">{account.provider_user_email}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDisconnect(account)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button onClick={handleConnectGoogle} variant="outline" className="w-full">
            <PlusCircle className="mr-2 h-4 w-4"/> Connect another Google Account
          </Button>
        </div>
      </div>

      {/* --- SOCIAL PLATFORMS SECTION --- */}
      <div>
        <h3 className="font-semibold mb-2">Social Platforms</h3>
        <div className="space-y-2">
            <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                    <LinkedInIcon />
                    <span className="text-sm font-medium">LinkedIn</span>
                </div>
                {linkedInConnection ? (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Connected</span>
                        <Button variant="ghost" size="sm" onClick={() => handleDisconnect(linkedInConnection)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ) : (
                    <Button onClick={handleConnectLinkedIn} size="sm">Connect</Button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}