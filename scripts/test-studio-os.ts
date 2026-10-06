import { AnimationStudioEngine } from "../src/sdk/AnimationStudioEngine";

async function main() {
  console.log("⚡ Starting AnimationStudioOS Local Test Harness...\n");

  const testConfig = {
    projectId: `test_run_${Date.now()}`,
    masterAudioUrl:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    comicPanelUrls: [
      "https://picsum.photos/1920/1080?random=1",
      "https://picsum.photos/1920/1080?random=2",
    ],
    characterVault: [
      {
        id: "hero_01",
        name: "Sovereign Lead",
        seedNumber: 8849201,
        referenceImageUrls: ["https://picsum.photos/800/800?random=10"],
        voiceId: "unity_disney_voice_01",
        defaultPromptPrefix:
          "dark graphic novel style, cinematic lighting, dramatic mood",
      },
    ],
    outputResolution: "1080p" as const,
    autoPublishToNetwork: false,
  };

  const engine = new AnimationStudioEngine(testConfig);

  engine.on("status", (event: { stage: string; message: string }) => {
    console.log(`[STAGE: ${event.stage}] ${event.message}`);
  });

  engine.on("complete", (result: { outputStreamUrl: string; published: boolean }) => {
    console.log("\n✅ PIPELINE COMPLETED SUCCESSFULLY!");
    console.log("Master Output:", result.outputStreamUrl);
  });

  engine.on("error", (err: unknown) => {
    console.error("\n❌ PIPELINE ERROR:", err);
  });

  const startTime = Date.now();
  await engine.runFullPipeline();
  console.log(
    `\n⏱ Total execution time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`,
  );
}

main().catch(console.error);
