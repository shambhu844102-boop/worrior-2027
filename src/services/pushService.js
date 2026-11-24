
import { supabase } from "../supabase";
const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY;

function decodeKey(key) {
  const padding = "=".repeat((4 - key.length % 4) % 4);
  const base64 = (key + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  return Uint8Array.from(
    atob(base64),
    char => char.charCodeAt(0)
  );
}

export async function enablePush(userId) {
  if (!("serviceWorker" in navigator) ||
      !("PushManager" in window)) {
    throw new Error("Push notifications are not supported.");
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error("VAPID public key is missing.");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");

  const subscription =
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeKey(VAPID_PUBLIC_KEY)
    });

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      subscription: subscription.toJSON(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: "endpoint"
    });

  if (error) throw error;

  return true;
}
