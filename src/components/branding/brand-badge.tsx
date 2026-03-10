import Link from "next/link";
import { Logo } from "@/components/site-logo";
import { DEFAULT_BRAND_NAME, getBrandingSettings } from "@/lib/branding";

type BrandBadgeProps = {
  href?: string;
  title?: string;
  subtitle: string;
  className?: string;
};

export async function BrandBadge(props: BrandBadgeProps) {
  const branding = await getBrandingSettings();
  const title = props.title ?? DEFAULT_BRAND_NAME;

  const content = (
    <>
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 ring-1 ring-primary/25">
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={`${title} logo`}
            className="h-full w-full object-contain p-1"
          />
        ) : (
          <Logo className="h-5 w-5 text-primary" />
        )}
      </div>
      <div className="leading-tight">
        <div className="font-display text-sm font-semibold tracking-tight">{title}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{props.subtitle}</div>
      </div>
    </>
  );

  if (!props.href) {
    return <div className={props.className ?? "flex items-center gap-2"}>{content}</div>;
  }

  return (
    <Link href={props.href} className={props.className ?? "flex items-center gap-2"}>
      {content}
    </Link>
  );
}
