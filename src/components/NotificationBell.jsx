import "./notifications.css";
import { useEffect, useState } from "react";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  subscribeNotifications,
} from "../services/notificationService";

export default function NotificationBell({ user }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    let active = true;

    getNotifications(user.id)
      .then(data => {
        if (active) setItems(data);
      })
      .catch(console.error);

    const unsubscribe = subscribeNotifications(
      user.id,
      notification => {
        setItems(previous => [notification, ...previous]);

        if (
          Notification.permission === "granted" &&
          document.visibilityState === "hidden"
        ) {
          new Notification(notification.title, {
            body: notification.body,
            icon: "/favicon.ico",
          });
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
        previous.map(n =>
          n.id === item.id ? { ...n, is_read: true } : n
        )
      );

      if (item.link) window.location.assign(item.link);
    } catch (error) {
      console.error(error);
    }
  }

  async function readAll() {
    try {
      await markAllAsRead(user.id);
      setItems(previous =>
        previous.map(n => ({ ...n, is_read: true }))
      );
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="notification-wrapper">
      <button
        className="notification-bell"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications, ${unread} unread`}
      >
        🔔
        {unread > 0 && (
          <span className="notification-count">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-header">
            <strong>Notifications</strong>
            <button onClick={readAll}>
              Mark all read
            </button>
          </div>

          {items.length === 0 ? (
            <p>No notifications yet.</p>
          ) : (
            items.map(item => (
              <button
                key={item.id}
                className={`notification-item ${
                  item.is_read ? "read" : "unread"
                }`}
                onClick={() => readOne(item)}
              >
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>
                  {new Date(item.created_at).toLocaleString()}
                </small>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
