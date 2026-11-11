const GPU_FLAG='--hardware-acceleration=if-possible';
const CPU_FLAG='--hardware-acceleration=disable';

/** Remotion's if-possible mode can select NVENC from FFmpeg's encoder list
 * even if the NVIDIA driver/CUDA device is absent at encoding time. */
export function isHardwareEncoderFailure(error){
  const output=String(error?.message||error);
  if(/Cannot load (?:libcuda(?:\.so(?:\.\d+)?)?|nvcuda\.dll)|No NVENC capable devices found|Driver does not support the required nvenc API|OpenEncodeSessionEx failed|Cannot init CUDA|CUDA_ERROR_NO_DEVICE|CUDA_ERROR_NOT_INITIALIZED/i.test(output))return true;
  return /(?:Encoder:\s*(?:h264|hevc)_nvenc\b|\[(?:h264|hevc)_nvenc\s*@)/i.test(output)&&
    /(?:Error while opening encoder|Could not open encoder|Failed to initialize|Failed to open encoder|Conversion failed!)/i.test(output);
}

/** Retry only hardware-encoder failures, never syntax errors or cancellations. */
export async function runRemotionWithEncodingFallback(command,{execute,signal,hardwareAccel=false,onFallback}={}){
  try{return await execute(command);}
  catch(error){
    if(!hardwareAccel||signal?.aborted||!command.includes(GPU_FLAG)||!isHardwareEncoderFailure(error))throw error;
    const cpuCommand=command.map(arg=>arg===GPU_FLAG?CPU_FLAG:arg);
    onFallback?.(error);
    return execute(cpuCommand);
  }
}
