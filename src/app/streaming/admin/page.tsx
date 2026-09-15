"use client";

import { useState } from "react";
import { AdminLineupManager } from "@/streaming/admin/AdminLineupManager";
import { ChannelWorkspaceAdmin } from "@/streaming/admin/ChannelWorkspaceAdmin";
import { cloneChannelPresets } from "@/streaming/config/channelPresets";

export default function StreamingAdminPage() {
  const [channels, setChannels] = useState(cloneChannelPresets);

  return (
    <div className="space-y-8 p-6">
      <AdminLineupManager />
      <ChannelWorkspaceAdmin
        initialChannels={channels}
        onSaveNetworks={setChannels}
      />
    </div>
  );
}
