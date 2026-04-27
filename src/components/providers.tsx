"use client";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import { LocaleProvider } from "@/contexts/locale";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function PushSetup() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;

    async function subscribe() {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey!),
        });

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
      } catch {
        // Push not supported or denied — silent fail
      }
    }

    subscribe();
  }, [session]);

  return null;
}

function SWSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});

    const handleOnline = async () => {
      const reg = await navigator.serviceWorker.ready;
      if ("sync" in reg) {
        (reg as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } })
          .sync.register("sync-orders").catch(() => {});
      } else {
        reg.active?.postMessage({ type: "SYNC_NOW" });
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LocaleProvider>
        <SWSetup />
        <PushSetup />
        {children}
      </LocaleProvider>
    </SessionProvider>
  );
}
