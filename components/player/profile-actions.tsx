"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSessionStore } from "@/stores/session-store";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { ProfileEditor } from "./profile-editor";

/** First visit straight to /profile: create the guest session, then re-render on the server. */
export function EnsureSession({ hasSession }: { hasSession: boolean }) {
  const router = useRouter();
  const load = useSessionStore((s) => s.load);
  useEffect(() => {
    void load().then((p) => {
      if (p && !hasSession) router.refresh();
    });
  }, [load, hasSession, router]);
  return null;
}

export function EditProfileButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Edit profile" description="Your name and look, everywhere you play.">
        <ProfileEditor
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </Dialog>
    </>
  );
}
