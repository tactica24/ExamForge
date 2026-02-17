"use client";

import * as React from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

function getInitials(name: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((piece) => piece[0]?.toUpperCase())
    .join("");
  return initials || "U";
}

export function AvatarUploader(props: { name: string; avatarUrl?: string | null }) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState(props.avatarUrl ?? null);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("Image is too large. Please upload 2MB or less.");
      event.currentTarget.value = "";
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? "Upload failed.");
      }

      const nextUrl = `${payload.avatarUrl}${payload.avatarUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
      setAvatarUrl(nextUrl);
      toast.success("Avatar updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload avatar.";
      toast.error(message);
    } finally {
      setIsUploading(false);
      event.currentTarget.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarImage src={avatarUrl ?? undefined} alt={`${props.name} avatar`} />
          <AvatarFallback>{getInitials(props.name)}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <p className="text-sm font-medium">Profile photo</p>
          <p className="text-xs text-muted-foreground">JPG, PNG, or WEBP. Max file size: 2MB.</p>
        </div>
      </div>
      <Input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onFileChange}
        disabled={isUploading}
      />
      {isUploading ? <p className="text-xs text-muted-foreground">Uploading...</p> : null}
    </div>
  );
}
