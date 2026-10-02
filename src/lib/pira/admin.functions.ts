import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(6).max(72),
});

/** Admin-only: set another account's password. */
export const adminSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw error;
    return { ok: true };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

/** Admin-only: accounts whose profile was fully removed earlier (can be restored). */
export const adminListOrphans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const { data: profs } = await supabaseAdmin.from("profiles").select("id");
    const have = new Set((profs ?? []).map((p) => p.id));
    return (data?.users ?? [])
      .filter((u) => !have.has(u.id))
      .map((u) => ({ id: u.id, username: (u.email ?? "user").split("@")[0] ?? "user" }));
  });

export const adminRestoreOrphan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), username: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .insert({ id: data.id, username: data.username, display_name: data.username });
    if (error) throw error;
    return { ok: true };
  });
