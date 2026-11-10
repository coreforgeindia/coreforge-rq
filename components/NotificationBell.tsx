"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  Volume2,
  VolumeX,
  AtSign,
  ArrowUpRight,
} from "lucide-react";
import type { PortalNotification, RequirementStep } from "@/lib/portal-types";

interface NotificationBellProps {
  notifications: PortalNotification[];
  currentUserId: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenNotification: (projectId: string, step: RequirementStep) => void;
}

export function NotificationBell({
  notifications,
  currentUserId,
  soundEnabled,
  onToggleSound,
  onMarkRead,
  onMarkAllRead,
  onOpenNotification,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const myNotifications = notifications.filter(
    (n) => n.recipientId === currentUserId
  );
  const unreadMineCount = myNotifications.filter((n) => !n.read).length;
  const visibleList = tab === "mine" ? myNotifications : notifications;

  return (
    <div className="notif-wrap" ref={containerRef}>
      <button
        type="button"
        className={`icon-button notification ${unreadMineCount > 0 ? "has-unread" : ""}`}
        aria-label={`Notifications (${unreadMineCount} unread)`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell size={18} />
        {unreadMineCount > 0 && (
          <span className="notif-badge">{unreadMineCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-popover" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <div>
              <b>Notifications</b>
              <small>
                {unreadMineCount > 0
                  ? `${unreadMineCount} unread for you`
                  : "You're all caught up"}
              </small>
            </div>
            <div className="notif-head-actions">
              <button
                type="button"
                className="notif-chip"
                onClick={onToggleSound}
                title={soundEnabled ? "Mute notification sound" : "Enable sound"}
              >
                {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
                {soundEnabled ? "Sound on" : "Muted"}
              </button>
            </div>
          </div>

          <div className="notif-tabs">
            <button
              type="button"
              className={tab === "mine" ? "active" : ""}
              onClick={() => setTab("mine")}
            >
              For me ({myNotifications.length})
            </button>
            <button
              type="button"
              className={tab === "all" ? "active" : ""}
              onClick={() => setTab("all")}
            >
              All workspace ({notifications.length})
            </button>
            {unreadMineCount > 0 && (
              <button
                type="button"
                className="notif-mark-all"
                onClick={onMarkAllRead}
              >
                <CheckCheck size={13} /> Mark read
              </button>
            )}
          </div>

          <div className="notif-list">
            {visibleList.length === 0 ? (
              <div className="notif-empty">
                <AtSign size={18} />
                <p>No notifications yet. Tag a teammate with @Name in any requirement.</p>
              </div>
            ) : (
              visibleList.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`notif-item ${!item.read && item.recipientId === currentUserId ? "unread" : ""}`}
                  onClick={() => {
                    onMarkRead(item.id);
                    onOpenNotification(item.projectId, item.step);
                    setOpen(false);
                  }}
                >
                  <div className="notif-avatar">
                    {item.actorName
                      .split(" ")
                      .map((x) => x[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="notif-copy">
                    <div className="notif-title-line">
                      <b>{item.title}</b>
                      {!item.read && item.recipientId === currentUserId && (
                        <span className="notif-unread-dot" />
                      )}
                    </div>
                    <p>{item.message}</p>
                    <div className="notif-meta">
                      <span>
                        {item.projectId} · {item.projectCompany}
                        {item.section ? ` · ${item.section}` : ""}
                      </span>
                      <span>
                        To {item.recipientName} · {item.createdAt}
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="notif-arrow" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

