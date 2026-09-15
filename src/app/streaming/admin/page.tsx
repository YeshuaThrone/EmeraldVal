"use client";

import { useState } from "react";
import { ChannelWorkspaceAdmin } from "@/streaming/admin/ChannelWorkspaceAdmin";
import { cloneChannelPresets } from "@/streaming/config/channelPresets";

export default function StreamingAdminPage() {
  const [channels, setChannels] = useState(cloneChannelPresets);

  return (
    <ChannelWorkspaceAdmin
      initialChannels={channels}
      onSaveNetworks={setChannels}
    />
  );
}
