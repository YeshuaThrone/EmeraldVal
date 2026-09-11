import { BaseBaasAdapter } from "./BaasAdapter";

/** Unit BaaS adapter — sandbox ACH/RTP until UNIT_API_KEY is issued. */
export class UnitAdapter extends BaseBaasAdapter {
  readonly provider = "unit" as const;
}
