"use client";

import React, { useEffect, useState } from "react";
import { STREAMING_ROUTE } from "@/lib/routes";
import { CreatorOnboardingPortal } from "./CreatorOnboardingPortal";

export const CreatorOnboardGate: React.FC<{ inviteToken: string }> = ({
  inviteToken,
}) => {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);

    void fetch(`/api/invites/validate/${encodeURIComponent(inviteToken)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          window.location.replace(STREAMING_ROUTE);
          return;
        }
        setAllowed(true);
      })
      .catch(() => {
        if (cancelled) return;
        window.location.replace(STREAMING_ROUTE);
      })
      .finally(() => {
        window.clearTimeout(timer);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [inviteToken]);

  if (!allowed) {
    return (
      <div className="font-epg flex min-h-screen items-center justify-center bg-[#050814] text-yellow-400">
        <p className="text-sm font-black tracking-widest">WORFI NETWORK</p>
      </div>
    );
  }

  return <CreatorOnboardingPortal inviteToken={inviteToken} />;
};
