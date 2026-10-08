#include "WerfiStudioBridge.h"
#include "Misc/Paths.h"

UWerfiStudioBridge::UWerfiStudioBridge()
{
	ActiveCameraAngle = TEXT("CAM_WIDE_01");
	ActiveLightingPreset = TEXT("NEON_CYAN_NIGHT");
}

void UWerfiStudioBridge::StreamAudioTrackToRig(FString AudioPath, FString TargetCharacter)
{
	UE_LOG(LogTemp, Log, TEXT("[WERFI UE5 Bridge] Ingesting track: %s for Character: %s"), *AudioPath, *TargetCharacter);

	if (!FPaths::FileExists(AudioPath))
	{
		UE_LOG(LogTemp, Error, TEXT("[WERFI UE5 Bridge] Audio file does not exist at path: %s"), *AudioPath);
		return;
	}

	OnAudioTrackReceived.Broadcast(AudioPath, TargetCharacter);
}

void UWerfiStudioBridge::UpdateStageProperties(FString CameraAngle, FString LightingPreset)
{
	ActiveCameraAngle = CameraAngle;
	ActiveLightingPreset = LightingPreset;

	UE_LOG(LogTemp, Log, TEXT("[WERFI UE5 Bridge] Stage Updated -> Cam: %s | Lighting: %s"), *CameraAngle, *LightingPreset);

	OnStagePropertiesUpdated.Broadcast(ActiveCameraAngle, ActiveLightingPreset);
}
