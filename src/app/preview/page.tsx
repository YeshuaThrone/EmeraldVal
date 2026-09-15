"use client";

import React from "react";
import { WorfiPreviewSDK } from "@/streaming/preview/WorfiPreviewSDK";

export default function PreviewPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <WorfiPreviewSDK />
    </div>
  );
}
