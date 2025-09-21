// src/app/(app)/settings/AutomationList.tsx - Client Component
'use client';
import { Button } from "@/components/ui/button";
import { AutomationForm } from "./AutomationForm";
import { PlusCircle } from "lucide-react";
type Automation = { id: string; name: string; platform: string; prompt: string; };

export function AutomationList({ automations }: { automations: Automation[] }) {
  return (
    <div className="space-y-4">
      {automations.map(auto => (
        <AutomationForm key={auto.id} automation={auto}>
          <div className="flex items-center justify-between p-4 border rounded-md cursor-pointer hover:bg-muted/50">
            <span className="font-medium">{auto.name}</span>
            <span className="text-sm text-muted-foreground capitalize">{auto.platform}</span>
          </div>
        </AutomationForm>
      ))}
      <AutomationForm>
        <Button variant="outline" className="w-full"><PlusCircle className="mr-2 h-4 w-4"/> New Automation</Button>
      </AutomationForm>
    </div>
  );
}