import { useState } from 'react'

interface Project {
  id: string
  name: string
  type: string
  status: 'active' | 'completed' | 'archived' | 'on_hold'
  customerName?: string
  deviceName?: string
  description?: string
  createdAt: string
  updatedAt: string
  tags: string[]
  repairCount: number
  notes?: string
}

const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1', name: 'Galaxy S24 - No Power', type: 'repair', status: 'active',
    customerName: 'John Doe', deviceName: 'Samsung Galaxy S24',
    description: 'Device not powering on after water exposure',
    createdAt: '2024-05-20', updatedAt: '2024-05-21',
    tags: ['water_damage', 'no_power', 'urgent'], repairCount: 3,
  },
  {
    id: 'p2', name: 'Pixel 8 Pro - Boot Loop', type: 'diagnostics', status: 'active',
    customerName: 'Jane Smith', deviceName: 'Google Pixel 8 Pro',
    description: 'Device stuck in boot loop after update',
    createdAt: '2024-05-19', updatedAt: '2024-05-20',
    tags: ['boot_loop', 'firmware_flash'], repairCount: 1,
  },
  {
    id: 'p3', name: 'iPhone 15 - Screen Replacement', type: 'repair', status: 'completed',
    customerName: 'Bob Wilson', deviceName: 'Apple iPhone 15',
    description: 'Cracked screen replacement',
    createdAt: '2024-05-15', updatedAt: '2024-05-16',
    tags: ['display_issue'], repairCount: 1,
  },
  {
    id: 'p4', name: 'ESP32 Sensor Board', type: 'engineering', status: 'active',
    description: 'Custom IoT sensor board design and testing',
    createdAt: '2024-05-10', updatedAt: '2024-05-18',
    tags: ['embedded', 'iot'], repairCount: 0,
  },
]

export function Projects() {
  const [projects] = useState<Project[]>(MOCK_PROJECTS)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredProjects = projects.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(p.customerName || '').toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-600'
      case 'completed': return 'bg-blue-600'
      case 'archived': return 'bg-gray-600'
      case 'on_hold': return 'bg-yellow-600'
      default: return 'bg-gray-600'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'repair': return '🔧'
      case 'diagnostics': return '🔍'
      case 'engineering': return '⚡'
      case 'research': return '🔬'
      case 'data_recovery': return '💾'
      default: return '📋'
    }
  }

  return (
    <div className="flex h-full">
      <div className="w-96 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-3 border-b border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="flex-1 bg-gray-700 text-white px-3 py-1 rounded text-sm"
            />
          </div>
          <div className="flex gap-1">
            {['all', 'active', 'completed', 'archived'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-2 py-0.5 rounded text-xs capitalize ${
                  filterStatus === status ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {filteredProjects.map(project => (
            <div
              key={project.id}
              onClick={() => setSelectedProject(project)}
              className={`p-3 border-b border-gray-700 cursor-pointer ${
                selectedProject?.id === project.id ? 'bg-blue-900/30' : 'hover:bg-gray-750'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span>{getTypeIcon(project.type)}</span>
                <span className="font-medium text-sm flex-1">{project.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs text-white ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>
              {project.customerName && (
                <div className="text-xs text-gray-400">{project.customerName}</div>
              )}
              {project.deviceName && (
                <div className="text-xs text-gray-500">{project.deviceName}</div>
              )}
              <div className="flex gap-1 mt-1">
                {project.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="px-1 py-0.5 bg-gray-700 rounded text-xs text-gray-400">{tag}</span>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Updated: {project.updatedAt} | {project.repairCount} repairs
              </div>
            </div>
          ))}
        </div>

        <div className="p-2 border-t border-gray-700">
          <button className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm">
            + New Project
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {selectedProject ? (
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{getTypeIcon(selectedProject.type)}</span>
              <div>
                <h2 className="text-xl font-semibold">{selectedProject.name}</h2>
                <div className="text-sm text-gray-400">
                  {selectedProject.customerName && `Customer: ${selectedProject.customerName}`}
                  {selectedProject.deviceName && ` | Device: ${selectedProject.deviceName}`}
                </div>
              </div>
              <div className="flex-1" />
              <span className={`px-3 py-1 rounded text-sm text-white ${getStatusColor(selectedProject.status)}`}>
                {selectedProject.status}
              </span>
            </div>

            {selectedProject.description && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Description</h3>
                <p className="text-sm text-gray-300">{selectedProject.description}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-400">Created</div>
                <div className="text-sm font-medium">{selectedProject.createdAt}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-400">Last Updated</div>
                <div className="text-sm font-medium">{selectedProject.updatedAt}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-400">Repairs</div>
                <div className="text-sm font-medium">{selectedProject.repairCount}</div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-1">
                {selectedProject.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-gray-700 rounded text-sm">{tag}</span>
                ))}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Files & Attachments</h3>
              <div className="text-sm text-gray-400">
                No files attached. Drag and drop files here or click to upload.
              </div>
            </div>

            <div className="flex gap-2">
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm">Add Repair</button>
              <button className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm">Edit Project</button>
              <button className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm">Export Report</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-lg">Select a project to view details</p>
            <p className="text-sm mt-2">Or create a new project to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}
