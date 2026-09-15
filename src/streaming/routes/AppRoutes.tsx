"use client";

import React, { useMemo } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useSearchParams,
} from "react-router-dom";
import { AdminLineupManager } from "../admin/AdminLineupManager";
import { ChannelWorkspaceAdmin } from "../admin/ChannelWorkspaceAdmin";
import { NetworkAnalyticsDashboard } from "../admin/NetworkAnalyticsDashboard";
import { CreatorOnboardingPortal } from "../admin/creator-onboarding/CreatorOnboardingPortal";
import { RetroPlayerContainer } from "../components/RetroPlayerContainer";
import { RetroTVGuide } from "../components/RetroTVGuide";
import { cloneChannelPresets } from "../config/channelPresets";
import { MultiChannelEngine } from "../playout/multiChannelEngine";
import { WorfiAppShell } from "../shell/WorfiAppShell";

const OnboardWrapper = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || undefined;
  return <CreatorOnboardingPortal inviteToken={token} />;
};

export const AppRoutes: React.FC = () => {
  const engine = useMemo(
    () => new MultiChannelEngine(cloneChannelPresets()),
    [],
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorfiAppShell />} />
        <Route
          path="/player"
          element={<RetroPlayerContainer engine={engine} />}
        />
        <Route
          path="/guide"
          element={
            <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 p-6">
              <RetroTVGuide engine={engine} />
            </div>
          }
        />
        <Route
          path="/admin"
          element={
            <div className="space-y-8 p-6">
              <AdminLineupManager />
              <ChannelWorkspaceAdmin
                initialChannels={cloneChannelPresets()}
                onSaveNetworks={() => {}}
              />
            </div>
          }
        />
        <Route path="/admin/analytics" element={<NetworkAnalyticsDashboard />} />
        <Route path="/onboard" element={<OnboardWrapper />} />
        <Route path="*" element={<Navigate to="/player" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
