# WERFI STUDIO OS - Headless Movie Render Queue
# Invoked by UnrealEditor-Cmd -ExecutePythonScript (no shell exec from Node).

import os
import sys
import unreal


def frame_rate(target_fps):
    if abs(float(target_fps) - 29.97) < 0.02:
        return unreal.FrameRate(numerator=30000, denominator=1001)
    rounded = int(round(float(target_fps)))
    return unreal.FrameRate(numerator=rounded, denominator=1)


def output_resolution(width, height):
    return unreal.IntPoint(int(width), int(height))


def execute_ue5_render(
    sequence_path,
    output_directory,
    target_fps=29.97,
    width=1920,
    height=1080,
):
    print(f"[UE5 Python MRQ] Initializing render for sequence: {sequence_path}")

    sequence_asset = unreal.EditorAssetLibrary.load_asset(sequence_path)
    if not sequence_asset:
        print(f"[UE5 Python MRQ] Error: Could not load Level Sequence at {sequence_path}")
        sys.exit(1)

    subsystem = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)
    queue = subsystem.get_queue()
    if hasattr(queue, "delete_all_jobs"):
        queue.delete_all_jobs()
    else:
        queue.clear_jobs()

    job = queue.allocate_new_job(unreal.MoviePipelineExecutorJob)
    job.job_name = "WERFI_UE5_Shot_Render"
    job.sequence = unreal.SoftObjectPath(sequence_path)

    config = job.get_configuration()
    output_setting = config.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
    output_setting.output_directory.path = os.path.abspath(output_directory)
    output_setting.output_resolution = output_resolution(width, height)
    output_setting.custom_frame_rate = frame_rate(target_fps)

    config.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG)

    executor = unreal.MoviePipelineInProcessExecutor()
    subsystem.render_queue_with_executor_instance(executor)
    print("[UE5 Python MRQ] Render job submitted to Movie Pipeline Executor.")


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        fps = float(sys.argv[3]) if len(sys.argv) >= 4 else 29.97
        width = int(sys.argv[4]) if len(sys.argv) >= 5 else 1920
        height = int(sys.argv[5]) if len(sys.argv) >= 6 else 1080
        execute_ue5_render(sys.argv[1], sys.argv[2], fps, width, height)
    else:
        print("Usage: render-ue5-mrq.py <sequence_path> <output_directory> [fps] [width] [height]")
        sys.exit(1)
