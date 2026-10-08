#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "WerfiStudioBridge.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
	FOnAudioTrackReceived,
	const FString&,
	AudioPath,
	const FString&,
	TargetCharacter);

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
	FOnStagePropertiesUpdated,
	const FString&,
	CameraAngle,
	const FString&,
	LightingPreset);

/**
 * Native UE5 bridge for Werfi Studio OS Remote Control + Audio2Face LiveLink.
 * Place a Blueprint subclass in the level so REST can call StreamAudioTrackToRig.
 */
UCLASS(Blueprintable, BlueprintType)
class UWerfiStudioBridge : public UObject
{
	GENERATED_BODY()

public:
	UWerfiStudioBridge();

	UPROPERTY(BlueprintReadWrite, Category = "Werfi Studio")
	FString ActiveCameraAngle;

	UPROPERTY(BlueprintReadWrite, Category = "Werfi Studio")
	FString ActiveLightingPreset;

	UPROPERTY(BlueprintAssignable, Category = "Werfi Studio")
	FOnAudioTrackReceived OnAudioTrackReceived;

	UPROPERTY(BlueprintAssignable, Category = "Werfi Studio")
	FOnStagePropertiesUpdated OnStagePropertiesUpdated;

	UFUNCTION(BlueprintCallable, Category = "Werfi Studio")
	void StreamAudioTrackToRig(FString AudioPath, FString TargetCharacter);

	UFUNCTION(BlueprintCallable, Category = "Werfi Studio")
	void UpdateStageProperties(FString CameraAngle, FString LightingPreset);
};
