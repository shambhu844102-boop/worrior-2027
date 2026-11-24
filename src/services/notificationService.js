import { supabase } from "../supabase";

// Get the current user's most recent notifications.
export async function getNotifications(userId) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("SUPABASE NOTIFICATION ERROR", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  return data || [];
}

// Mark one notification as read.
export async function markAsRead(id) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);

  if (error) throw error;
}

// Mark all unread notifications for this user as read.
export async function markAllAsRead(userId) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;
}

// Listen for this user's notification inserts. The row-level table policy
// remains responsible for deciding which rows this authenticated user can read.
export function subscribeNotifications(userId, callback, onStatus) {
  const channel = supabase
    .channel(`notifications-${userId}`, { config: { private: true } })
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      payload => callback(payload.new)
    )
    .subscribe((status, error) => {
      if (typeof onStatus === "function") onStatus(status, error);
      if (error) console.error("Notification channel error:", error);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
