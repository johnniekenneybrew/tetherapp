import supabase from "./_supabase.js";

export async function getPref(key, userId = "") {
  const { data } = await supabase.from("prefs").select("value")
    .eq("key", key).eq("user_id", userId).maybeSingle();
  return data?.value ?? null;
}

export async function setPref(key, value, userId = "") {
  const { error } = await supabase.from("prefs").upsert(
    { user_id: userId, key, value, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  );
  if (error) throw error;
}
