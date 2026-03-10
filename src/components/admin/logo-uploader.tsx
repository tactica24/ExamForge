"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const BRAND_NAME = "ACE NAIJA";

export function LogoUploader(props: { logoUrl?: string | null }) {
  const router = useRouter();
  const [isUploading, setIsUploading] = React.useState(false);
  const [logoUrl, setLogoUrl] = React.useState(props.logoUrl ?? null);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("Logo is too large. Please upload 2MB or less.");
      event.currentTarget.value = "";
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/branding/logo", {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? "Upload failed.");
      }

      const nextUrl = `${payload.logoUrl}${payload.logoUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
      setLogoUrl(nextUrl);
      router.refresh();
      toast.success("Logo updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload logo.";
      toast.error(message);
    } finally {
      setIsUploading(false);
      event.currentTarget.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border bg-background p-2">
          {logoUrl ? (
            <img src={logoUrl} alt={`${BRAND_NAME} logo`} className="h-full w-full object-contain" />
          ) : (
            <div className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">No logo</div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Platform logo</p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, or WEBP. The uploaded image is contained inside the existing logo slot automatically.
          </p>
        </div>
      </div>
      <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} disabled={isUploading} />
      {isUploading ? <p className="text-xs text-muted-foreground">Uploading...</p> : null}
    </div>
  );
}
