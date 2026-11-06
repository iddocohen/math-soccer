// Copied from math-tank tests/e2e/updateServer.d.mts.
/** Types for tests/e2e/updateServer.mjs. */
export interface UpdateServer {
  url: string;
  serve(version: string): void;
  stop(): Promise<void>;
}
export const UPDATE_PORT: number;
export function startUpdateServer(versions: string[]): Promise<UpdateServer>;
