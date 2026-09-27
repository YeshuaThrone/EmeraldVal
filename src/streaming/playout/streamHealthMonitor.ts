export class StreamHealthMonitor {
  /**
   * Verifies if a media asset URL is reachable and responding
   */
  public static async verifyStreamUrl(
    url: string,
    timeoutMs: number = 3000,
  ): Promise<boolean> {
    if (!url) return false;

    // YouTube embed URLs are assumed valid by structural format
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return true;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      clearTimeout(timeout);
      console.warn(
        `[Stream Monitor] Primary stream failed health check: ${url}`,
      );
      return false;
    }
  }

  /**
   * Returns standard standby media asset if target fails
   */
  public static getEmergencyFallbackUrl(): string {
    return (
      process.env.NEXT_PUBLIC_WORFI_STANDBY_VIDEO_URL ||
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
    );
  }
}
