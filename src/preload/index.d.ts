/* eslint-disable @typescript-eslint/no-explicit-any */
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

export interface ReviewSourceAPI {
  listSources: () => Promise<any[]>
  getSource: (payload: { sourceId: string }) => Promise<any | null>
  createSource: (payload: any) => Promise<any>
  updateSource: (payload: any) => Promise<any>
  getDeleteImpact: (payload: {
    sourceId: string
  }) => Promise<{ soleReferencedItemCount: number; sharedReferencedItemCount: number }>
  deleteSource: (payload: {
    sourceId: string
    itemPolicy: 'archive' | 'delete' | 'keep-history'
  }) => Promise<{ success: boolean }>
  setEnabled: (payload: { sourceId: string; enabled: boolean }) => Promise<any>
}

export interface NotionMetadataAPI {
  resolveTarget: (payload: { target: string }) => Promise<any>
  listProperties: (payload: { target: string }) => Promise<any[]>
  validateMapping: (payload: any) => Promise<{ valid: boolean; errors: string[] }>
  previewMapping: (payload: any) => Promise<any>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    notionConnection: NotionConnectionAPI
    reviewSource: ReviewSourceAPI
    notionMetadata: NotionMetadataAPI
  }
}
