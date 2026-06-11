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

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
contextBridge.exposeInMainWorld('notionConnection', notionConnection)
