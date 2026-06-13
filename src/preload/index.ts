/* eslint-disable @typescript-eslint/no-explicit-any */
import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url)
}

const notionConnection = {
  getStatus: (): Promise<string> => ipcRenderer.invoke('notion:get-status'),
  saveToken: (payload: { token: string }): Promise<string> =>
    ipcRenderer.invoke('notion:save-token', payload),
  deleteToken: (): Promise<string> => ipcRenderer.invoke('notion:delete-token'),
  verify: (): Promise<string> => ipcRenderer.invoke('notion:verify')
}

const reviewSource = {
  listSources: (): Promise<any> => ipcRenderer.invoke('source:list'),
  getSource: (payload: { sourceId: string }): Promise<any> =>
    ipcRenderer.invoke('source:get', payload),
  createSource: (payload: any): Promise<any> => ipcRenderer.invoke('source:create', payload),
  updateSource: (payload: any): Promise<any> => ipcRenderer.invoke('source:update', payload),
  getDeleteImpact: (payload: { sourceId: string }): Promise<any> =>
    ipcRenderer.invoke('source:get-delete-impact', payload),
  deleteSource: (payload: {
    sourceId: string
    itemPolicy: 'archive' | 'delete' | 'keep-history'
  }): Promise<any> => ipcRenderer.invoke('source:delete', payload),
  setEnabled: (payload: { sourceId: string; enabled: boolean }): Promise<any> =>
    ipcRenderer.invoke('source:set-enabled', payload)
}

const notionMetadata = {
  resolveTarget: (payload: { target: string }): Promise<any> =>
    ipcRenderer.invoke('notion:resolve-target', payload),
  listProperties: (payload: { target: string }): Promise<any> =>
    ipcRenderer.invoke('notion:list-properties', payload),
  validateMapping: (payload: any): Promise<any> =>
    ipcRenderer.invoke('notion:validate-mapping', payload),
  previewMapping: (payload: any): Promise<any> =>
    ipcRenderer.invoke('notion:preview-mapping', payload)
}

const manualSync = {
  syncAll: (): Promise<any> => ipcRenderer.invoke('sync:all'),
  syncSource: (payload: { sourceId: string }): Promise<any> =>
    ipcRenderer.invoke('sync:source', payload),
  cancel: (): Promise<{ cancelled: true }> => ipcRenderer.invoke('sync:cancel'),
  onProgress: (listener: (progress: any) => void): (() => void) => {
    const handler = (_event: unknown, progress: any): void => listener(progress)
    ipcRenderer.on('sync:progress', handler)
    return () => ipcRenderer.removeListener('sync:progress', handler)
  }
}

const todayReview = {
  list: (payload?: {
    sort?: 'due' | 'random'
    filter?:
      | { kind: 'unclassified' }
      | { kind: 'category'; value: string }
      | { kind: 'tag'; value: string }
      | { kind: 'source'; sourceId: string }
  }): Promise<any> =>
    payload
      ? ipcRenderer.invoke('review:list-today', payload)
      : ipcRenderer.invoke('review:list-today')
}

const reviewRating = {
  rate: (payload: {
    reviewItemId: string
    rating: 'again' | 'hard' | 'good' | 'easy'
  }): Promise<any> => ipcRenderer.invoke('review:rate', payload)
}

const statusPages = {
  list: (payload: { kind: 'changed' | 'missing-deleted' }): Promise<any> =>
    ipcRenderer.invoke('status-pages:list', payload),
  handleChanged: (payload: {
    reviewItemId: string
    action: 'pull-today' | 'keep-schedule'
  }): Promise<any> => ipcRenderer.invoke('status-pages:handle-changed', payload)
}

const documentViewer = {
  open: (payload: {
    url: string
    bounds: { x: number; y: number; width: number; height: number }
  }): Promise<any> => ipcRenderer.invoke('document-viewer:open', payload),
  openExternal: (payload: { url: string }): Promise<any> =>
    ipcRenderer.invoke('document-viewer:open-external', payload),
  close: (): Promise<any> => ipcRenderer.invoke('document-viewer:close'),
  resize: (payload: {
    bounds: { x: number; y: number; width: number; height: number }
  }): Promise<any> => ipcRenderer.invoke('document-viewer:resize', payload)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
contextBridge.exposeInMainWorld('notionConnection', notionConnection)
contextBridge.exposeInMainWorld('reviewSource', reviewSource)
contextBridge.exposeInMainWorld('notionMetadata', notionMetadata)
contextBridge.exposeInMainWorld('manualSync', manualSync)
contextBridge.exposeInMainWorld('todayReview', todayReview)
contextBridge.exposeInMainWorld('reviewRating', reviewRating)
contextBridge.exposeInMainWorld('statusPages', statusPages)
contextBridge.exposeInMainWorld('documentViewer', documentViewer)
