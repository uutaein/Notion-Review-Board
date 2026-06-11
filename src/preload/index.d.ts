export interface ElectronAPI {
  getAppVersion: () => Promise<string>
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
