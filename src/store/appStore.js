import { create } from 'zustand'

const useAppStore = create((set, get) => ({
  // Current project state
  currentProject: null,
  currentRevision: null,
  currentDataset: null,
  
  // UI state
  isSaving: false,
  saveStatus: 'saved', // 'saving' | 'saved' | 'unsaved' | 'error'
  
  // Find & Replace panel
  findReplaceOpen: false,
  
  // Settings
  appSettings: {},
  
  // Actions
  setCurrentProject: (project) => set({ currentProject: project }),
  setCurrentRevision: (revision) => set({ currentRevision: revision }),
  setCurrentDataset: (dataset) => set({ currentDataset: dataset }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setFindReplaceOpen: (open) => set({ findReplaceOpen: open }),
  setAppSettings: (settings) => set({ appSettings: settings }),

  loadProject: async (projectId) => {
    try {
      if (!window.api) return null
      const result = await window.api.projects.get(projectId)
      if (result.success) {
        set({
          currentProject: result.project,
          currentRevision: result.revision,
          currentDataset: result.dataset,
        })
        return result
      }
      return null
    } catch (err) {
      console.error('Failed to load project:', err)
      return null
    }
  },

  loadSettings: async () => {
    try {
      if (!window.api) return
      const result = await window.api.settings.get()
      if (result.success) {
        set({ appSettings: result.settings })
      }
    } catch {}
  },
}))

export default useAppStore

