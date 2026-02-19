"use client";

import * as React from "react";
import { useFormState } from "react-dom";
import { AlertCircle } from "lucide-react";

type ActionResult = { ok: boolean; message?: string } | undefined;

export function AuthFormState(props: {
  action: (prevState: unknown, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  encType?: string;
}) {
  const [state, formAction] = useFormState(props.action, undefined);

  return (
    <form action={formAction} className="space-y-4" encType={props.encType}>
      {state?.ok === false && state.message ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>{state.message}</div>
        </div>
      ) : null}
      {props.children}
    </form>
  );
}
