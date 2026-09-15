import type { CableOverlayState } from "./cableGraphicsEngine";
import type { LowerThirdState } from "./lowerThirdEngine";

export type OverlayLayer =
  | { kind: "scanlines" }
  | { kind: "channel-bug"; label: string; channelNumber: number }
  | {
      kind: "promo";
      promoType: CableOverlayState["interludePromo"]["promoType"];
      title: string;
    }
  | { kind: "lower-third"; line1: string; line2: string };

/**
 * Composites cable bug / promo / lower-third state into ordered overlay
 * layers the RetroCablePlayer (or a canvas renderer) can draw.
 */
export class OverlayCanvas {
  public static layersFromState(
    overlay: CableOverlayState,
    lowerThird?: LowerThirdState,
  ): OverlayLayer[] {
    const layers: OverlayLayer[] = [{ kind: "scanlines" }];

    if (overlay.channelBug.visible) {
      layers.push({
        kind: "channel-bug",
        label: overlay.channelBug.channelName,
        channelNumber: overlay.channelBug.channelNumber,
      });
    }

    if (overlay.interludePromo.visible) {
      layers.push({
        kind: "promo",
        promoType: overlay.interludePromo.promoType,
        title:
          overlay.interludePromo.showTitle ??
          overlay.interludePromo.creatorName ??
          "",
      });
    }

    if (lowerThird?.visible) {
      layers.push({
        kind: "lower-third",
        line1: lowerThird.line1,
        line2: lowerThird.line2,
      });
    }

    return layers;
  }
}
