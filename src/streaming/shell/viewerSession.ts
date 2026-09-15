export const VIEWER_SESSION_KEY = "worfi-viewer-session";

export type ViewerSession = {
  displayName: string;
};

export function parseViewerSession(raw: string | null): ViewerSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ViewerSession>;
    const displayName =
      typeof parsed.displayName === "string" ? parsed.displayName.trim() : "";
    return displayName ? { displayName } : null;
  } catch {
    return null;
  }
}

export function readViewerSession(): ViewerSession | null {
  if (typeof window === "undefined") return null;
  return parseViewerSession(window.sessionStorage.getItem(VIEWER_SESSION_KEY));
}

export function writeViewerSession(session: ViewerSession): void {
  window.sessionStorage.setItem(VIEWER_SESSION_KEY, JSON.stringify(session));
}

export function clearViewerSession(): void {
  window.sessionStorage.removeItem(VIEWER_SESSION_KEY);
}
