import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAppStore from '../store/appStore'
import { useRemoteConfig } from '../hooks/useRemoteConfig'
import { AnnouncementBanner, UpdateBanner, MaintenanceScreen } from './RemoteConfigUI'
import { ForceUpdateScreen, UpdateToastBanner } from './AutoUpdateUI'

export default function AppShell() {
  const { loadSettings, currentProject } = useAppStore()
  const location = useLocation()
  const { config } = useRemoteConfig()

  // Extract projectId from path like /project/:id/...
  const projectMatch = location.pathname.match(/^\/project\/([^/]+)/)
  const projectId = projectMatch ? projectMatch[1] : null

  useEffect(() => {
    loadSettings()
  }, [])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f8f9fa' }}>
      {/* Maintenance overlay — overrides everything */}
      <MaintenanceScreen config={config} />
      <ForceUpdateScreen config={config} />

      {/* Sidebar */}
      <aside className="w-44 flex-shrink-0 flex flex-col" style={{ background: '#fff', borderRight: '1px solid #e0e0e0' }}>
        {/* Logo */}
        <div className="px-4 py-3 border-b border-gray-100">
          <NavLink to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#1a73e8' }}>
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800 leading-tight">Local PDF</div>
              <div className="text-[11px] text-gray-500 leading-tight">Studio</div>
            </div>
          </NavLink>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {/* Global nav */}
          <div className="space-y-0.5">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <HomeIcon className="w-4 h-4 flex-shrink-0" />
              Dashboard
            </NavLink>

            <NavLink
              to="/library"
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <LibraryIcon className="w-4 h-4 flex-shrink-0" />
              PDF Library
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <SettingsIcon className="w-4 h-4 flex-shrink-0" />
              Settings
            </NavLink>
          </div>

          {/* Project-contextual nav */}
          {projectId && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="px-3 mb-2">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Current Project
                </div>
                {currentProject && (
                  <div className="text-xs text-gray-700 font-medium mt-0.5 truncate">
                    {currentProject.name}
                  </div>
                )}
              </div>

              <div className="space-y-0.5">
                <NavLink
                  to={`/project/${projectId}/editor`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  <EditorIcon className="w-4 h-4 flex-shrink-0" />
                  Editor
                </NavLink>

                <NavLink
                  to={`/project/${projectId}/generate`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  <GenerateIcon className="w-4 h-4 flex-shrink-0" />
                  Generate PDFs
                </NavLink>

                <NavLink
                  to={`/project/${projectId}/library`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  <LibraryIcon className="w-4 h-4 flex-shrink-0" />
                  PDF Files
                </NavLink>

                <NavLink
                  to={`/project/${projectId}/history`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  <HistoryIcon className="w-4 h-4 flex-shrink-0" />
                  History
                </NavLink>
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-gray-100">
          {/* Status */}
          <div className="flex items-center gap-1.5 px-1">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <span className="text-[11px] text-gray-400">100% Offline</span>
          </div>
          <div className="text-[10px] text-gray-300 mt-0.5 px-1">Local PDF Studio v1.2.0</div>
        </div>
      </aside>

      {/* Main content — banners on top, page below */}
      <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
        {/* Remote config banners */}
        <UpdateBanner config={config} />
        <UpdateToastBanner config={config} />
        <AnnouncementBanner config={config} />
        {/* Page */}
        <main className="flex-1 min-h-0 overflow-hidden relative">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function HomeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function LibraryIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  )
}

function SettingsIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function EditorIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function GenerateIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function HistoryIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
