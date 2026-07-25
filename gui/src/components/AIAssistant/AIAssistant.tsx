import { useState } from 'react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface DiagnosticSuggestion {
  title: string
  confidence: number
  description: string
  steps: string[]
  tools: string[]
  parts: string[]
}

const MOCK_SUGGESTIONS: DiagnosticSuggestion[] = [
  {
    title: 'PMIC Failure Detected',
    confidence: 0.87,
    description: 'Current signature matches known PM8550 failure pattern. Voltage drop on VREG_L3 rail suggests primary PMIC is not maintaining output.',
    steps: [
      'Measure VREG_L3 at PM8550 output (TP101)',
      'Check input voltage to PM8550 (VBAT rail)',
      'If no output, reball PM8550 BGA',
      'If persists, replace PM8550',
    ],
    tools: ['Multimeter', 'Hot air station', 'Microscope'],
    parts: ['PM8550 ($12.50)'],
  },
  {
    title: 'USB-C Connector Issue',
    confidence: 0.72,
    description: 'Intermittent USB connection suggests worn or damaged USB-C connector pins. CC line voltage instability detected.',
    steps: [
      'Inspect USB-C connector under microscope',
      'Check CC1/CC2 line continuity',
      'Replace USB-C connector if pins are damaged',
      'Reflow solder joints',
    ],
    tools: ['Microscope', 'Soldering iron', 'Hot air station'],
    parts: ['USB-C 16P connector ($1.20)'],
  },
]

export function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m the TechBench AI Assistant. I can help with:\n\n- Component identification and datasheet lookup\n- Board-level diagnostics and fault finding\n- Power analysis interpretation\n- Repair procedure recommendations\n- Test point identification\n\nDescribe your issue or ask a question to get started.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ])
  const [input, setInput] = useState('')
  const [suggestions] = useState<DiagnosticSuggestion[]>(MOCK_SUGGESTIONS)

  const sendMessage = () => {
    if (!input.trim()) return
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')

    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Based on your description, here are my recommendations:\n\n1. Check the PMIC output rails with a multimeter\n2. Measure current draw at the battery connector\n3. Compare against known boot signatures\n\nThe most likely cause is a PMIC failure based on the symptoms you described. Would you like me to provide a detailed repair procedure?`,
        timestamp: new Date().toLocaleTimeString(),
      }
      setMessages(prev => [...prev, aiMsg])
    }, 1000)
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 p-2 bg-gray-800 border-b border-gray-700">
          <span className="text-lg">🤖</span>
          <span className="text-sm font-semibold">AI Repair Assistant</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-gray-400">Model loaded</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-2xl rounded-lg p-3 ${
                msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'
              }`}>
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                <div className="text-xs text-gray-400 mt-1">{msg.timestamp}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-2 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm"
              placeholder="Describe your issue or ask a question..."
            />
            <button onClick={sendMessage} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm">
              Send
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            {['Identify component', 'Find test points', 'Power analysis', 'Repair guide'].map(q => (
              <button
                key={q}
                onClick={() => { setInput(q); }}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">AI Suggestions</h3>
        <div className="space-y-3">
          {suggestions.map((sug, i) => (
            <div key={i} className="bg-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{sug.title}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  sug.confidence > 0.8 ? 'bg-green-900 text-green-400' :
                  sug.confidence > 0.6 ? 'bg-yellow-900 text-yellow-400' :
                  'bg-gray-600 text-gray-300'
                }`}>
                  {(sug.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{sug.description}</p>
              <div className="text-xs">
                <div className="text-gray-400 mb-1">Steps:</div>
                <ol className="list-decimal list-inside space-y-0.5">
                  {sug.steps.map((step, j) => (
                    <li key={j} className="text-gray-300">{step}</li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {sug.tools.map(tool => (
                  <span key={tool} className="px-1.5 py-0.5 bg-gray-600 rounded text-xs">{tool}</span>
                ))}
              </div>
              {sug.parts.length > 0 && (
                <div className="mt-1 text-xs text-green-400">
                  Parts: {sug.parts.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
