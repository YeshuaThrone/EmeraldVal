import { BaseBaasAdapter } from "./BaasAdapter";

/** Column BaaS adapter — sandbox ACH/RTP until COLUMN_API_KEY is issued. */
export class ColumnAdapter extends BaseBaasAdapter {
  readonly provider = "column" as const;
}
