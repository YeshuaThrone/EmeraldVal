import type { ChannelNetworkConfig } from "../playout/multiChannelEngine";

const SAMPLE = {
  bunny:
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  elephants:
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  blazes:
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  escapes:
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  joyrides:
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
};

export const CHANNEL_PRESETS: ChannelNetworkConfig[] = [
  {
    channelId: "ch-atx-01",
    channelNumber: 1,
    channelName: "WORFI MAIN",
    category: "ATX Live Sessions",
    stationBugLogoUrl: "",
    programmingGrid: [
      {
        id: "vid-8829",
        title: "ATX Live Sessions: Ep 4",
        creatorName: "Yeshua Throne",
        type: "SHOW",
        videoUrl: SAMPLE.bunny,
        durationSeconds: 1800,
      },
      {
        id: "vid-8830",
        title: "Midnight Modular Modular",
        creatorName: "Worfi Network",
        type: "SHOW",
        videoUrl: SAMPLE.elephants,
        durationSeconds: 1200,
      },
    ],
  },
  {
    channelId: "ch-haven",
    channelNumber: 2,
    channelName: "HAVEN TV",
    category: "Real Estate & Spaces",
    stationBugLogoUrl: "",
    programmingGrid: [
      {
        id: "haven-show-1",
        title: "East Side Lofts",
        creatorName: "Maya Ellison",
        type: "SHOW",
        videoUrl: SAMPLE.bunny,
        durationSeconds: 120,
        metadata: {
          episodeTitle: "Open House Walkthrough",
          socialHandle: "@mayae",
        },
      },
      {
        id: "haven-promo-1",
        title: "Creator Spotlight: Maya",
        creatorName: "Maya Ellison",
        type: "CREATOR_PROMO",
        videoUrl: SAMPLE.blazes,
        durationSeconds: 30,
        metadata: { socialHandle: "@mayae" },
      },
      {
        id: "haven-id-1",
        title: "Haven TV Station ID",
        creatorName: "Haven Network",
        type: "STATION_ID",
        videoUrl: SAMPLE.escapes,
        durationSeconds: 15,
      },
    ],
  },
  {
    channelId: "ch-block",
    channelNumber: 7,
    channelName: "BLOCK TV",
    category: "Culture & Drama",
    stationBugLogoUrl: "",
    programmingGrid: [
      {
        id: "block-show-1",
        title: "Sixth Street After Dark",
        creatorName: "Jordan Vale",
        type: "SHOW",
        videoUrl: SAMPLE.elephants,
        durationSeconds: 90,
        metadata: {
          episodeTitle: "Night Market Set",
          socialHandle: "@jordanvale",
        },
      },
      {
        id: "block-interlude-1",
        title: "Network Interlude",
        creatorName: "Block TV",
        type: "INTERLUDE",
        videoUrl: SAMPLE.joyrides,
        durationSeconds: 20,
      },
      {
        id: "block-promo-1",
        title: "Coming Up: Jordan Vale",
        creatorName: "Jordan Vale",
        type: "CREATOR_PROMO",
        videoUrl: SAMPLE.blazes,
        durationSeconds: 25,
        metadata: { socialHandle: "@jordanvale" },
      },
    ],
  },
];

export function cloneChannelPresets(): ChannelNetworkConfig[] {
  return structuredClone(CHANNEL_PRESETS);
}
