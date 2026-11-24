import "./notifications.css";
import React, { useEffect, useState } from "react";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  subscribeNotifications,
} from "../services/notificationService";

export default function NotificationBell({ user }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState("connecting");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      setConnection("offline");
      return undefined;
    }

    let active = true;

    const upsertNotification = (notification) => {
      if (!notification?.id) return;
      setItems(previous => {
        const next = [
          notification,
          ...previous.filter(item => item.id !== notification.id),
        ];
        return next
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 50);
      });
    };

    getNotifications(user.id)
      .then(data => {
        if (!active) return;
        // Merge instead of replacing: a realtime event can arrive while the
        // initial request is still in flight.
        setItems(previous => {
          const byId = new Map();
          [...previous, ...(data || [])].forEach(item => byId.set(item.id, item));
          return [...byId.values()]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 50);
        });
      })
      .catch(error => {
        console.error("Notification fetch failed:", error);
        if (active) setStatusMessage("Notifications could not be loaded. Please refresh.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = subscribeNotifications(
      user.id,
      upsertNotification,
      (status, error) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setConnection("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("offline");
          if (error) console.error("Notification realtime subscription:", error);
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.id]);

  const unread = items.filter(item => !item.is_read).length;

  async function readOne(item) {
    try {
      await markAsRead(item.id);
      setItems(previous =>
        previous.map(notification =>
          notification.id === item.id
            ? { ...notification, is_read: true }
            : notification
        )
      );
      setStatusMessage("");
      setOpen(false);
      if (item.link) window.location.assign(item.link);
    } catch (error) {
      console.error("Mark notification as read failed:", error);
      setStatusMessage("Could not mark this notification as read. Try again.");
    }
  }

  async function readAll() {
    if (!user?.id || unread === 0) return;
    try {
      await markAllAsRead(user.id);
      setItems(previous =>
        previous.map(notification => ({ ...notification, is_read: true }))
      );
      setStatusMessage("");
    } catch (error) {
      console.error("Mark all notifications as read failed:", error);
      setStatusMessage("Could not update notifications. Try again.");
    }
  }

  return (
    <div className="notification-wrapper">
      <button
        type="button"
        className="notification-bell"
        onClick={() => setOpen(current => !current)}
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
        aria-controls="worrior-notification-panel"
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span className="notification-count">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <section
          id="worrior-notification-panel"
          className="notification-panel"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="notification-header">
            <div className="notification-header-copy">
              <strong>Notifications</strong>
              <small>{unread} unread</small>
            </div>
            <div className="notification-header-actions">
              <button
                type="button"
                className="notification-read-all"
                onClick={readAll}
                disabled={unread === 0}
              >
                Mark all read
              </button>
              <button
                type="button"
                className="notification-close"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                ×
              </button>
            </div>
          </div>

          {statusMessage && (
            <p className="notification-status-message" role="status">
              {statusMessage}
            </p>
          )}

          {loading ? (
            <p className="notification-empty">Loading notifications…</p>
          ) : items.length === 0 ? (
            <p className="notification-empty">No notifications yet.</p>
          ) : (
            <div className="notification-list">
              {items.map(item => (
                <button
                  type="button"
                  key={item.id}
                  className={`notification-item ${item.is_read ? "read" : "unread"}`}
                  onClick={() => readOne(item)}
                >
                  <strong>{item.title || "WORRIOR 2027"}</strong>
                  <p>{item.body || "You have a new update."}</p>
                  <small>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : ""}
                  </small>
                </button>
              ))}
            </div>
          )}
          <div className="notification-footer" aria-live="polite">
            <span className={`notification-connection-dot ${connection}`} />
            {connection === "connected"
              ? "Live updates on"
              : connection === "offline"
                ? "Live updates reconnecting"
                : "Connecting…"}
          </div>
        </section>
      )}
    </div>
  );
}
