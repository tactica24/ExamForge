"use server";

import { z } from "zod";
import { createFirebaseServerClient } from "@/lib/firebase/server";

const UpdateSchema = z.object({
  item_id: z.string().uuid(),
  status: z.enum(["todo", "done", "skipped"])
});

export async function updatePlanItemStatusAction(_: unknown, formData: FormData) {
  const parsed = UpdateSchema.safeParse({
    item_id: formData.get("item_id"),
    status: formData.get("status")
  });
  if (!parsed.success) return { ok: false, message: "Invalid update." };

  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { error } = await firebase.from("plan_items").update({ status: parsed.data.status }).eq("id", parsed.data.item_id);
  if (error) return { ok: false, message: error.message };

  return { ok: true };
}
