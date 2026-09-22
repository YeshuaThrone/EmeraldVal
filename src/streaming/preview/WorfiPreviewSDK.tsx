"use client";

import React from "react";
import { WorfiAppShell } from "../shell/WorfiAppShell";

/** `/preview` is the live cable player, not a toy SDK card. */
export const WorfiPreviewSDK: React.FC = () => {
  return <WorfiAppShell livePreview />;
};
