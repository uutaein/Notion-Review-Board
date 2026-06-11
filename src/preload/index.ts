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

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
contextBridge.exposeInMainWorld('notionConnection', notionConnection)
contextBridge.exposeInMainWorld('reviewSource', reviewSource)
contextBridge.exposeInMainWorld('notionMetadata', notionMetadata)
