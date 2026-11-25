import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\\s+/i, "");
    if (!token) return json({ error: "Требуется авторизация" }, 401);
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !anonKey || !serviceKey) return json({ error: "Серверная конфигурация не завершена" }, 500);
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Недействительная сессия" }, 401);
    const { data: manager, error: managerError } = await userClient.rpc("is_admin");
    if (managerError || manager !== true) return json({ error: "Недостаточно прав" }, 403);

    const body = await req.json();
    const targetId = String(body?.targetId || "");
    const newEmail = typeof body?.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    if (!targetId || targetId === authData.user.id) return json({ error: "Нельзя изменять собственные данные через панель управления" }, 400);
    if (!newEmail && !newPassword) return json({ error: "Укажите новую почту или пароль" }, 400);
    if (newEmail && (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(newEmail) || newEmail.length > 254)) return json({ error: "Укажите корректный адрес электронной почты" }, 400);
    if (newPassword && (newPassword.length < 8 || newPassword.length > 72)) return json({ error: "Пароль должен содержать от 8 до 72 символов" }, 400);

    const { data: target, error: targetError } = await userClient.from("profiles").select("id,email").eq("id", targetId).maybeSingle();
    if (targetError || !target) return json({ error: "Аккаунт не найден" }, 404);
    if (String(target.email || "").toLowerCase() === "supportmytanks@gmail.com") return json({ error: "Служебный аккаунт нельзя изменять через панель управления" }, 403);
    if (newEmail && newEmail === "supportmytanks@gmail.com") return json({ error: "Этот адрес закреплён за служебным аккаунтом" }, 409);

    const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const updates: Record<string, unknown> = {};
    if (newEmail) {
      updates.email = newEmail;
      updates.email_confirm = true;
    }
    if (newPassword) updates.password = newPassword;
    const { error: updateError } = await adminClient.auth.admin.updateUserById(targetId, updates);
    if (updateError) return json({ error: updateError.message }, 400);
    const { error: auditError } = await adminClient.from("account_admin_audit").insert({
      target_user_id: targetId, actor_user_id: authData.user.id, action: "account_credentials_forced",
      details: { email_changed: Boolean(newEmail), password_changed: Boolean(newPassword), email: newEmail || null },
    });
    if (auditError) return json({ error: "Данные обновлены, но запись аудита не удалась: " + auditError.message }, 500);
    return json({ success: true, emailChanged: Boolean(newEmail), passwordChanged: Boolean(newPassword) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Внутренняя ошибка сервера" }, 400);
  }
});