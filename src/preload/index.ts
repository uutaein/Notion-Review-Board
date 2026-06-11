import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
