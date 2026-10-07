import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildUe5MrqArgs,
  callUE5RemoteControl,
  renderHeadlessUE5Shot,
  triggerAudio2FaceLiveLink,
  ue5RemoteControlUrl,
} from "./UnrealEngineStudioSDK";

describe("UE5 Remote Control", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("PUTs objectPath and functionName to the Remote Control endpoint", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ReturnValue: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callUE5RemoteControl({
      objectPath: "/Game/WerfiStudio/Cameras.Cameras",
      functionName: "SetCameraAngle",
      parameters: { Angle: "wide" },
    });

    expect(result).toEqual({ ReturnValue: true });
    expect(fetchMock).toHaveBeenCalledWith(
      ue5RemoteControlUrl(),
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as { body: string }).body,
    ) as { objectPath: string; functionName: string };
    expect(body.objectPath).toBe("/Game/WerfiStudio/Cameras.Cameras");
    expect(body.functionName).toBe("SetCameraAngle");
  });

  it("rejects a missing function name", async () => {
    await expect(
      callUE5RemoteControl({ objectPath: "/Game/Foo", functionName: "  " }),
    ).rejects.toThrow(/objectPath and functionName/);
  });
});

describe("Audio2Face LiveLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("streams Rodecaster audio to the MetaHuman LiveLink target", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ReturnValue: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await triggerAudio2FaceLiveLink(
      "/tmp/internal-studio/ep_01/master.wav",
      "hero_01",
    );

    expect(result).toEqual({
      status: "STREAMING_ACTIVE",
      streamingChannel: "livelink_hero_01",
    });
    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as { body: string }).body,
    ) as {
      objectPath: string;
      functionName: string;
      parameters: { TargetCharacter: string };
    };
    expect(body.objectPath).toContain("WerfiStudioBridge");
    expect(body.functionName).toBe("StreamAudioTrackToRig");
    expect(body.parameters.TargetCharacter).toBe("hero_01");
  });
});

describe("headless Movie Render Queue", () => {
  it("builds spawn argv with Unattended, framerate, and no shell string", () => {
    const planned = buildUe5MrqArgs({
      uprojectPath: "/tmp/internal-studio/WerfiStudio.uproject",
      sequencePath: "/Game/WerfiStudio/Sequences/Shot01",
      outputDirectory: "/tmp/internal-studio/ue5",
      targetResolution: "4K",
      targetFps: 29.97,
    });

    expect(planned.args[0]).toContain("WerfiStudio.uproject");
    expect(planned.args).toContain("-Unattended");
    const pythonArg = planned.args.find((part) =>
      part.startsWith("-ExecutePythonScript="),
    );
    expect(pythonArg).toContain("render-ue5-mrq.py");
    expect(pythonArg).toContain("29.97");
    expect(pythonArg).toContain("3840");
    expect(pythonArg).toContain("2160");
    expect(planned.args).not.toContain("-game");
    expect(planned.args.join(" ")).not.toContain("UnrealEditor-Cmd.exe\"");
    expect(planned.args.every((part) => !part.includes("&&"))).toBe(true);
    expect(planned.outputPath).toMatch(/ue5_render_\d+\.mp4$/);
  });

  it("runs MRQ through an injected runner instead of a shell exec", async () => {
    const runner = vi.fn(async () => undefined);
    const output = await renderHeadlessUE5Shot(
      {
        uprojectPath: "/tmp/internal-studio/WerfiStudio.uproject",
        sequencePath: "/Game/WerfiStudio/Sequences/Shot01",
        outputDirectory: "/tmp/internal-studio/ue5",
      },
      process.env,
      runner,
    );
    expect(output).toMatch(/ue5_render_\d+\.mp4$/);
    expect(runner).toHaveBeenCalledTimes(1);
    const [, args] = runner.mock.calls[0] as [string, string[]];
    expect(args).toContain("-NoLoadingScreen");
  });

  it("ships the native C++ bridge and Python MRQ script", () => {
    const cpp = readFileSync(
      path.join(
        process.cwd(),
        "unreal/WerfiStudio/Source/WerfiStudio/WerfiStudioBridge.cpp",
      ),
      "utf8",
    );
    const header = readFileSync(
      path.join(
        process.cwd(),
        "unreal/WerfiStudio/Source/WerfiStudio/WerfiStudioBridge.h",
      ),
      "utf8",
    );
    const py = readFileSync(
      path.join(
        process.cwd(),
        "unreal/WerfiStudio/Content/Python/render-ue5-mrq.py",
      ),
      "utf8",
    );
    expect(header).toContain("StreamAudioTrackToRig");
    expect(header).toContain("UpdateStageProperties");
    expect(cpp).toContain("OnAudioTrackReceived.Broadcast");
    expect(py).toContain("MoviePipelineQueueSubsystem");
    expect(py).toContain("29.97");
    expect(py).toContain("MoviePipelineInProcessExecutor");
  });
});
