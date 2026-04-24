import { logWarn } from "@/src/utils/logger";

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;

  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      logWarn("withTimeout", `${label} timed out after ${ms}ms — using null`);
      resolve(null);
    }, ms);
  });

  const result = await Promise.race([promise, timeout]);
  clearTimeout(timer!);
  return result;
}
