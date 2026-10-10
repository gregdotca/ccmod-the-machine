export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    'the-machine': { limits: Limit[]; hasBooted: boolean; bootFrame: number; isDisconnected: boolean; feedId: string; feedTick: number }
  }
}
