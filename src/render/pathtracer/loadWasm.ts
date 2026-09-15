// @ts-expect-error - Emscripten generated JS wrapper
import createPathTracerModule from './wasm/path_tracer.js';
import wasmBinaryUrl from './wasm/path_tracer.wasm?url';
import type { NativePathTracerExports } from './types';

let cachedModulePromise: Promise<NativePathTracerExports> | null = null;

/**
 * Loads and initializes the PathTracer WebAssembly module.
 * Works seamlessly in Browser (via Vite asset URL) and Node.js/Vitest (via buffer).
 */
export async function loadPathTracerWasm(): Promise<NativePathTracerExports> {
  if (cachedModulePromise) {
    return cachedModulePromise;
  }

  cachedModulePromise = (async () => {
    const fn =
      (createPathTracerModule as unknown as { default?: typeof createPathTracerModule }).default ??
      createPathTracerModule;

    // Node.js test environment (Vitest)
    const proc = (
      globalThis as unknown as {
        process?: {
          versions?: { node?: string };
          cwd?: () => string;
        };
      }
    ).process;

    if (proc?.versions?.node && typeof proc.cwd === 'function') {
      const fs = (await import('node:fs' as string)) as {
        readFileSync: (p: string) => ArrayBuffer;
      };
      const path = (await import('node:path' as string)) as {
        resolve: (...args: string[]) => string;
      };
      const wasmPath = path.resolve(proc.cwd(), 'src/render/pathtracer/wasm/path_tracer.wasm');
      const wasmBinary = fs.readFileSync(wasmPath);
      return await fn({ wasmBinary });
    }

    // Browser environment
    return await fn({
      locateFile: () => wasmBinaryUrl,
    });
  })();

  return cachedModulePromise;
}
