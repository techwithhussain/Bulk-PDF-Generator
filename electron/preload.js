const { contextBridge, ipcRenderer } = require('electron')

// Safe IPC bridge — renderer gets ONLY these named methods
contextBridge.exposeInMainWorld('api', {
  // Projects
  projects: {
    create: (data) => ipcRenderer.invoke('projects:create', data),
    get: (id) => ipcRenderer.invoke('projects:get', id),
    list: () => ipcRenderer.invoke('projects:list'),
    update: (id, data) => ipcRenderer.invoke('projects:update', id, data),
    delete: (id) => ipcRenderer.invoke('projects:delete', id),
    saveContent: (projectId, contentJson, label) =>
      ipcRenderer.invoke('projects:saveContent', projectId, contentJson, label),
    getRevisions: (projectId) => ipcRenderer.invoke('projects:getRevisions', projectId),
    restoreRevision: (revisionId) => ipcRenderer.invoke('projects:restoreRevision', revisionId),
  },

  // PDF Generation
  pdf: {
    generateBatch: (batchConfig) => ipcRenderer.invoke('pdf:generateBatch', batchConfig),
    cancelBatch: (batchId) => ipcRenderer.invoke('pdf:cancelBatch', batchId),
    retryFailed: (batchId) => ipcRenderer.invoke('pdf:retryFailed', batchId),
    getPreviewData: (projectId, rowData) => ipcRenderer.invoke('pdf:getPreviewData', projectId, rowData),
    getBatches: (projectId) => ipcRenderer.invoke('pdf:getBatches', projectId),
    getBatchItems: (batchId) => ipcRenderer.invoke('pdf:getBatchItems', batchId),
  },

  // Export / Download
  export: {
    downloadBatch: (batchId, destFolder) => ipcRenderer.invoke('export:downloadBatch', batchId, destFolder),
    downloadZip: (batchId) => ipcRenderer.invoke('export:downloadZip', batchId),
    chooseFolder: () => ipcRenderer.invoke('export:chooseFolder'),
    openFolder: (folderPath) => ipcRenderer.invoke('export:openFolder', folderPath),
    retryFailed: (batchId, destFolder) => ipcRenderer.invoke('export:retryFailed', batchId, destFolder),
  },

  // Find & Replace
  findReplace: {
    preview: (params) => ipcRenderer.invoke('findReplace:preview', params),
    apply: (params) => ipcRenderer.invoke('findReplace:apply', params),
    getHistory: (projectId) => ipcRenderer.invoke('findReplace:getHistory', projectId),
  },

  // Data Import (CSV / XLSX)
  dataImport: {
    parseFile: (filePath) => ipcRenderer.invoke('dataImport:parseFile', filePath),
    chooseFile: () => ipcRenderer.invoke('dataImport:chooseFile'),
    saveDataset: (projectId, datasetMeta) =>
      ipcRenderer.invoke('dataImport:saveDataset', projectId, datasetMeta),
    getDataset: (datasetId) => ipcRenderer.invoke('dataImport:getDataset', datasetId),
    getRows: (datasetId, limit, offset) =>
      ipcRenderer.invoke('dataImport:getRows', datasetId, limit, offset),
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings) => ipcRenderer.invoke('settings:set', settings),
    openLogsFolder: () => ipcRenderer.invoke('settings:openLogsFolder'),
    getAppVersion: () => ipcRenderer.invoke('settings:getAppVersion'),
  },

  // PDF Library
  library: {
    getItems: (projectId) => ipcRenderer.invoke('library:getItems', projectId),
    getAllItems: () => ipcRenderer.invoke('library:getAllItems'),
    renameItem: (itemId, newFilename) => ipcRenderer.invoke('library:renameItem', itemId, newFilename),
    deleteItem: (itemId) => ipcRenderer.invoke('library:deleteItem', itemId),
    openContainingFolder: (itemId) => ipcRenderer.invoke('library:openContainingFolder', itemId),
  },

  // IPC event listeners (progress updates, etc.)
  on: (channel, callback) => {
    const allowedChannels = [
      'batch:progress',
      'batch:itemDone',
      'batch:itemFailed',
      'batch:complete',
      'batch:canceled',
      'export:progress',
      'export:complete',
    ]
    if (allowedChannels.includes(channel)) {
      const listener = (_event, ...args) => callback(...args)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  },

  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback)
  },
})

