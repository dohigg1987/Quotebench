"use client";

import { useEffect } from "react";

export default function ViewTracker({ token }: { token: string }) {
  useEffect(() => {
    const visible = new Set<string>();
    const deviceHash = `${navigator.userAgent.length}-${window.screen.width}x${window.screen.height}`;
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { const section = (entry.target as HTMLElement).dataset.trackSection; if (!section) return; if (entry.isIntersecting) visible.add(section); else visible.delete(section); }), { threshold: 0.35 });
    document.querySelectorAll<HTMLElement>("[data-track-section]").forEach((element) => observer.observe(element));
    const timer = window.setTimeout(() => {
      void fetch(`/api/public/quotes/${token}/view`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventType: "open", deviceHash }), keepalive: true });
    }, 3000);
    const heartbeat = window.setInterval(() => { if (document.hidden) return; for (const section of visible) void fetch(`/api/public/quotes/${token}/view`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventType: "section_heartbeat", section, durationMs: 5000, deviceHash }), keepalive: true }); }, 5000);
    return () => { window.clearTimeout(timer); window.clearInterval(heartbeat); observer.disconnect(); };
  }, [token]);
  return null;
}
