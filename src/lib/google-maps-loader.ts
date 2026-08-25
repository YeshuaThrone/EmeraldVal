type GoogleMapsWindow = Window & {
  google?: {
    maps?: {
      maps3d?: {
        Map3DElement?: new (options: Record<string, unknown>) => GoogleMap3DElement;
        Marker3DElement?: new (options: Record<string, unknown>) => HTMLElement;
        Marker3DInteractiveElement?: new (options: Record<string, unknown>) => HTMLElement;
      };
    };
  };
};

export type GoogleMap3DElement = HTMLElement & {
  center: { lat: number; lng: number; altitude?: number };
  tilt: number;
  heading: number;
  range?: number;
};

let loadPromise: Promise<boolean> | null = null;

export function loadGoogleMapsSdk(apiKey: string): Promise<boolean> {
  if (typeof window === "undefined" || !apiKey) {
    return Promise.resolve(false);
  }
  const googleWindow = window as GoogleMapsWindow;
  if (googleWindow.google?.maps) {
    return Promise.resolve(true);
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve) => {
    const existing = document.getElementById("google-maps-sdk-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-sdk-script";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=beta&libraries=maps3d,places`;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function hasGoogleMap3D(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean((window as GoogleMapsWindow).google?.maps?.maps3d?.Map3DElement);
}

export function getMaps3d() {
  return (window as GoogleMapsWindow).google?.maps?.maps3d ?? null;
}
