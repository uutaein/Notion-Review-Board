export interface ElectronAPI {
  getAppVersion: () => Promise<string>
  openExternal: (url: string) => Promise<void>
}

export interface NotionConnectionAPI {
  getStatus: () => Promise<string>
  saveToken: (payload: { token: string }) => Promise<string>
  deleteToken: () => Promise<string>
  verify: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    notionConnection: NotionConnectionAPI
  }
}
