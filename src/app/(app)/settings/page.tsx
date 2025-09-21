// src/app/settings/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SocialConnections } from "./social-connections";
import { createClient } from "@/lib/supabase/server";
import { AutomationList } from "./AutomationList";

export default async function SettingsPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  // Fetch existing connections to pass to the client component
  const { data: connections } = await supabase
    .from('connected_accounts')
    .select('provider')
    .eq('user_id', user!.id);

    const { data: automations } = await supabase.from('automations').select('*').eq('user_id', user!.id);
    
  const connectedProviders = connections?.map(c => c.provider) || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Social Media Accounts</CardTitle>
            <CardDescription>Connect your accounts to enable one-click posting.</CardDescription>
          </CardHeader>
          <CardContent>
            <SocialConnections serverConnectedProviders={connectedProviders} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Automations</CardTitle>
            <CardDescription>Configure how your social media posts are generated.</CardDescription>
          </CardHeader>
          <CardContent>
            <AutomationList automations={automations || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}