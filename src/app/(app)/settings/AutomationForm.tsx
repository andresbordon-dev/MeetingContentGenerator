// src/app/(app)/settings/AutomationForm.tsx
'use client';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFormState } from "react-dom";
import { saveAutomation, deleteAutomation } from "../../actions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type Automation = { id: string; name: string; platform: string; prompt: string; };

export function AutomationForm({ children, automation }: { children: React.ReactNode, automation?: Automation | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(saveAutomation, null);

  useEffect(() => {
    if (state?.success) {
      toast.success(`Automation "${automation?.name || 'New'}" saved successfully!`);
      setOpen(false);
    } else if (state?.error) {
      toast.error(`Error: ${state.error}`);
    }
  }, [state]);

  const handleDelete = async () => {
    if (!automation) return;
    if (confirm(`Are you sure you want to delete "${automation.name}"?`)) {
        const result = await deleteAutomation(automation.id);
        if (result.success) {
            toast.success("Automation deleted.");
            setOpen(false);
        } else {
            toast.error(`Error: ${result.error}`);
        }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{automation ? "Edit Automation" : "Create Automation"}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={automation?.id} />
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" name="name" defaultValue={automation?.name} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Platform</Label>
              <Select name="platform" defaultValue={automation?.platform}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  {/* <SelectItem value="facebook" disabled>Facebook (coming soon)</SelectItem> */}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="prompt" className="text-right pt-2">Description</Label>
              <Textarea id="prompt" name="prompt" defaultValue={automation?.prompt} className="col-span-3 min-h-[120px]" placeholder="e.g., Draft a LinkedIn post (120-180 words)..." />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <div>
              {automation && (
                <Button type="button" variant="destructive" onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4"/> Delete</Button>
              )}
            </div>
            <div className="flex gap-2">
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit">Save & Close</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}