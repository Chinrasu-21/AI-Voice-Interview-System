import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Phone, 
  Search, 
  Upload, 
  Filter, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Volume2, 
  MicOff, 
  Grid, 
  X, 
  FileText, 
  Download, 
  TrendingUp, 
  ChevronRight,
  Info,
  Mic,
  Calendar,
  Award,
  Trash2
} from 'lucide-react'

const API_BASE_URL = 'http://localhost:8000/api'
const INTERVIEW_QUESTIONS = [
  "What is your name?",
  "What is your age?",
  "What is your qualification?",
  "Do you know Java?",
  "Do you know Spring Boot?"
]

// Default mock students list as fallback
const INITIAL_STUDENTS = [
  { id: 1, name: "Perumal", phone: "9876543210", status: "Pending" },
  { id: 3, name: "Arun", phone: "9876543212", status: "Pending" },
  { id: 4, name: "Vignesh", phone: "9876543213", status: "Pending" },
  { id: 5, name: "Hari", phone: "9876543214", status: "Pending" }
]

function App() {
  // Candidate / DB list state
  const [students, setStudents] = useState([])
  
  // Dashboard navigation / filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  
  // Calling popup overlay state
  const [activeCall, setActiveCall] = useState(null) // student object currently calling
  const [callState, setCallState] = useState('inactive') // 'inactive' | 'calling' | 'connecting' | 'connected' | 'completed'
  const [callDuration, setCallDuration] = useState(0)
  const [transcript, setTranscript] = useState([])
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaker, setIsSpeaker] = useState(false)
  const [isKeypad, setIsKeypad] = useState(false)
  const [listeningState, setListeningState] = useState(false) // whether student is speaking (animates sound wave)
  
  // Viewing report state
  const [activeReport, setActiveReport] = useState(null) // completed student report to display

  // Add Candidate modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCandidateName, setNewCandidateName] = useState('')
  const [newCandidatePhone, setNewCandidatePhone] = useState('')
  const [newCandidateAge, setNewCandidateAge] = useState('')
  const [newCandidateQual, setNewCandidateQual] = useState('')

  // Custom Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  // Custom Confirm Delete modal state
  const [confirmDelete, setConfirmDelete] = useState({ show: false, candidateId: null, candidateName: '' })

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }))
    }, 4000)
  }

  const handleDeleteCandidate = async () => {
    const candidateId = confirmDelete.candidateId
    if (!candidateId) return
    
    try {
      const res = await fetch(`${API_BASE_URL}/candidates/${candidateId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        showToast(`Candidate ${confirmDelete.candidateName} deleted successfully!`, 'success')
        fetchCandidates()
      } else {
        showToast("Failed to delete candidate.", "error")
      }
    } catch (err) {
      console.error(err)
      showToast("Error deleting candidate.", "error")
    } finally {
      setConfirmDelete({ show: false, candidateId: null, candidateName: '' })
    }
  }

  const handleAddCandidate = async (e) => {
    e.preventDefault()
    
    const nameTrimmed = newCandidateName.trim()
    const phoneTrimmed = newCandidatePhone.trim()
    
    // Strict Validation: Name must not be empty
    if (!nameTrimmed) {
      showToast("Please enter a valid candidate name.", "error")
      return
    }
    
    // Strict Validation: Phone must have at least 10 digits
    const cleanDigits = phoneTrimmed.replace(/\D/g, '')
    if (cleanDigits.length < 10) {
      showToast("Please enter a valid phone number with at least 10 digits.", "error")
      return
    }

    // Auto-format phone number to E.164 (+91 prefix if missing)
    let formattedPhone = phoneTrimmed
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = `+91${formattedPhone}`
      } else if (formattedPhone.startsWith('91') && formattedPhone.length === 12) {
        formattedPhone = `+${formattedPhone}`
      } else {
        formattedPhone = `+${formattedPhone}`
      }
    }

    try {
      const res = await fetch(`${API_BASE_URL}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameTrimmed,
          phone: formattedPhone
        })
      })
      if (res.ok) {
        showToast(`Candidate ${nameTrimmed} registered successfully!`, "success")
        setNewCandidateName('')
        setNewCandidatePhone('')
        setNewCandidateAge('')
        setNewCandidateQual('')
        setShowAddModal(false)
        fetchCandidates()
      } else {
        showToast("Failed to add candidate.", "error")
      }
    } catch (err) {
      console.error(err)
      showToast("Error adding candidate.", "error")
    }
  }
  
  // Calling duration timer ref
  const durationTimerRef = useRef(null)
  const simulationTimerRef = useRef([])
  const pollIntervalRef = useRef(null)

  // Fetch candidates on mount
  useEffect(() => {
    fetchCandidates()
  }, [])

  const fetchCandidates = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/candidates`)
      if (res.ok) {
        const data = await res.json()
        if (data.length === 0) {
          // If DB is empty, use initial array
          setStudents(INITIAL_STUDENTS)
        } else {
          setStudents(data.map(c => {
            const completedSession = c.sessions ? c.sessions.find(s => s.status === 'completed') : null
            const activeSession = c.sessions && c.sessions.length > 0 ? c.sessions[0] : null
            
            return {
              id: c.id,
              name: c.name,
              phone: c.phone || "N/A",
              status: completedSession ? 'Completed' : 'Pending',
              score: completedSession ? 88 : null,
              session_id: activeSession ? activeSession.id : null,
              answers: completedSession && completedSession.logs ? completedSession.logs.map(l => ({ q: l.question, a: l.answer })) : [],
              date: completedSession ? new Date(completedSession.created_at).toISOString().split('T')[0] : null,
              duration: completedSession ? "1m 30s" : null
            }
          }))
        }
      }
    } catch (err) {
      console.error("Failed to load candidates:", err)
      setStudents(INITIAL_STUDENTS)
    }
  }

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current)
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      simulationTimerRef.current.forEach(t => clearTimeout(t))
    }
  }, [])

  // Call duration counter
  useEffect(() => {
    if (callState === 'connected') {
      durationTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current)
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current)
    }
  }, [callState])

  // Handle CSV import (Registers candidates to MySQL and reloads)
  const handleImportCSV = async () => {
    const csvStudents = [
      { name: "Subash", phone: "+919876543215" },
      { name: "Vijay", phone: "+919876543216" },
      { name: "Saravanan", phone: "+919876543217" }
    ]
    
    try {
      for (const student of csvStudents) {
        await fetch(`${API_BASE_URL}/candidates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(student)
        })
      }
      showToast("Imported student records from CSV successfully!", "success")
      fetchCandidates()
    } catch (err) {
      console.error("Failed to import CSV candidates:", err)
      showToast("Failed to import candidates from CSV.", "error")
    }
  }

  // Initiate call trigger (Start session, trigger Twilio, and poll database)
  const handleStartCall = async (student) => {
    setActiveCall(student)
    setCallState('calling')
    setCallDuration(0)
    setTranscript([
      { sender: 'ai', text: "Calling candidate's phone..." }
    ])
    setListeningState(false)
    
    simulationTimerRef.current.forEach(t => clearTimeout(t))
    simulationTimerRef.current = []
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    pollIntervalRef.current = null

    try {
      // Step A: Start Interview Session in MySQL
      const sessionRes = await fetch(`${API_BASE_URL}/interviews/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: student.id })
      })

      if (!sessionRes.ok) throw new Error('Failed to initialize session in database.')
      const sessionData = await sessionRes.json()
      const sessionId = sessionData.id

      // Step B: Trigger Outbound Call via Twilio
      setTranscript(prev => [...prev, { sender: 'ai', text: "Dialing phone number..." }])
      
      const callRes = await fetch(`${API_BASE_URL}/interviews/${sessionId}/call`, {
        method: 'POST'
      })

      if (!callRes.ok) {
        const errData = await callRes.json()
        throw new Error(errData.detail || 'Failed to start outbound call.')
      }

      setCallState('connecting')
      setTranscript(prev => [...prev, { sender: 'ai', text: "Phone is ringing. Waiting for answer..." }])

      // Step C: Poll for Live Transcript Updates
      let isConnected = false
      
      pollIntervalRef.current = setInterval(async () => {
        try {
          const summaryRes = await fetch(`${API_BASE_URL}/interviews/${sessionId}/summary`)
          if (summaryRes.ok) {
            const data = await summaryRes.json()
            
            // Connect once database receives first logs or finishes
            if (!isConnected && (data.logs.length > 0 || data.status === 'completed')) {
              isConnected = true
              setCallState('connected')
              setTranscript([
                { sender: 'ai', text: "Hello. Welcome to the AI Interview. Let's begin." }
              ])
            }

            if (isConnected) {
              const chatHistory = [
                { sender: 'ai', text: "Hello. Welcome to the AI Interview. Let's begin." }
              ]
              data.logs.forEach(log => {
                chatHistory.push({ sender: 'ai', text: log.question })
                if (log.answer) {
                  chatHistory.push({ sender: 'student', text: log.answer })
                }
              })
              
              const numLogged = data.logs.length
              if (data.status !== 'completed' && numLogged < INTERVIEW_QUESTIONS.length) {
                chatHistory.push({ sender: 'ai', text: INTERVIEW_QUESTIONS[numLogged] })
                setListeningState(true) // sound wave animates
              } else {
                setListeningState(false)
              }
              
              setTranscript(chatHistory)
            }

            if (data.status === 'completed') {
              setCallState('completed')
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
              }
            }
          }
        } catch (pollErr) {
          console.error("Transcript polling error:", pollErr)
        }
      }, 2000)

    } catch (err) {
      showToast(err.message, "error")
      setCallState('inactive')
      setActiveCall(null)
    }
  }

  // End Call manually
  const handleEndCall = () => {
    simulationTimerRef.current.forEach(t => clearTimeout(t))
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    if (callState === 'connected') {
      setCallState('completed')
    } else {
      setCallState('inactive')
      setActiveCall(null)
    }
  }

  // Close completion report and update dashboard list status
  const handleSaveAndCloseCall = () => {
    fetchCandidates()
    setCallState('inactive')
    setActiveCall(null)
  }

  // Filter and search student list
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          student.phone.includes(searchTerm)
    const matchesFilter = statusFilter === 'All' || student.status === statusFilter
    return matchesSearch && matchesFilter
  })

  // Count summaries
  const totalCount = students.length
  const pendingCount = students.filter(s => s.status === 'Pending').length
  const completedCount = students.filter(s => s.status === 'Completed').length

  // Simulated PDF Downloader
  const handleDownloadPDF = (studentName) => {
    showToast(`Downloading PDF report for ${studentName}...`, "info")
  }

  return (
    <div className="min-h-screen p-6 md:p-10 flex flex-col items-center justify-start max-w-7xl mx-auto">
      {/* 1. Header Area */}
      <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-500 to-cyan-400">
            Aura Voice Calling Dashboard
          </h1>
          <p className="text-slate-400 text-sm md:text-base mt-1">
            Manage student phone campaigns and monitor real-time AI recruitment voice call results.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleImportCSV}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl font-medium shadow-md hover:scale-105 active:scale-100 transition-all duration-300"
          >
            <Upload size={18} />
            Import CSV
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-500 text-white rounded-xl font-medium shadow-lg hover:shadow-indigo-500/20 hover:scale-105 active:scale-100 transition-all duration-300"
          >
            + Add Student
          </button>
        </div>
      </div>

      {/* 2. Stats Row */}
      <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <div className="text-slate-400 text-xs md:text-sm font-medium">Total Students</div>
            <div className="text-2xl font-bold text-slate-100">{totalCount}</div>
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3.5 bg-yellow-500/10 text-yellow-400 rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-slate-400 text-xs md:text-sm font-medium">Pending Calls</div>
            <div className="text-2xl font-bold text-slate-100">{pendingCount}</div>
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="text-slate-400 text-xs md:text-sm font-medium">Completed</div>
            <div className="text-2xl font-bold text-slate-100">{completedCount}</div>
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3.5 bg-cyan-500/10 text-cyan-400 rounded-xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-slate-400 text-xs md:text-sm font-medium">Today's Targets</div>
            <div className="text-2xl font-bold text-slate-100">3</div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="w-full bg-slate-900/20 backdrop-blur-md border border-slate-800/50 rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Search by student name or phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/40 border border-slate-800 text-white rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-300"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto items-center justify-end">
          <Filter className="text-slate-500" size={16} />
          <span className="text-slate-400 text-sm font-medium mr-2">Filter:</span>
          {['All', 'Pending', 'Completed'].map(filterOption => (
            <button
              key={filterOption}
              onClick={() => setStatusFilter(filterOption)}
              className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-xl transition-all duration-300 ${
                statusFilter === filterOption
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-950/30 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              {filterOption}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Students Table */}
      <div className="w-full bg-slate-900/20 backdrop-blur-md border border-slate-800/50 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/30 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6">Name</th>
                <th className="py-4 px-6">Phone Number</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right" style={{ width: '160px' }}>Action</th>
                <th className="py-4 px-6 text-right" style={{ width: '80px' }}>Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-sm text-slate-200 font-medium">
              {filteredStudents.length > 0 ? (
                filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-900/20 transition-colors duration-200">
                    <td className="py-4 px-6 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-slate-800 flex items-center justify-center font-bold text-indigo-300">
                        {student.name[0]}
                      </div>
                      <span className="text-slate-100 font-semibold">{student.name}</span>
                    </td>
                    <td className="py-4 px-6 text-slate-300 tracking-wide font-normal">{student.phone}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${
                        student.status === 'Completed'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          student.status === 'Completed' ? 'bg-emerald-400' : 'bg-yellow-400'
                        }`} />
                        {student.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {student.status === 'Completed' ? (
                        <button
                          onClick={() => setActiveReport(student)}
                          className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-200 rounded-xl hover:text-white transition-all duration-300 font-medium text-xs shadow-sm hover:shadow-slate-800/10 active:scale-95"
                          style={{ width: '130px', justifyContent: 'center' }}
                        >
                          <FileText size={14} />
                          View Report
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartCall(student)}
                          className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-xl font-medium text-xs shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/25 hover:scale-105 active:scale-95 transition-all duration-300"
                          style={{ width: '130px', justifyContent: 'center' }}
                        >
                          <Phone size={14} className="fill-white" />
                          Call
                        </button>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setConfirmDelete({ show: true, candidateId: student.id, candidateName: student.name })}
                        className="inline-flex items-center justify-center p-2.5 bg-slate-950/60 border border-slate-850 hover:border-red-500/40 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl transition-all duration-300 active:scale-90 shadow-sm"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-400 text-base">
                    No student records match the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. CALLING POPUP OVERLAY */}
      <AnimatePresence>
        {callState !== 'inactive' && activeCall && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0f1422] border border-slate-800/60 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col h-[650px] relative"
            >
              {/* Top call state bar */}
              <div className="w-full bg-slate-950/40 p-4 border-b border-slate-800/40 flex items-center justify-between">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">AI Voice Recruiter System</span>
                <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold bg-indigo-500/10 px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                  SIMULATED CALL
                </span>
              </div>

              {/* Call Simulation View (Active Conversation) */}
              {callState !== 'completed' ? (
                <>
                  {/* Visual Avatar & calling state */}
                  <div className="p-6 flex flex-col items-center text-center">
                    <div className="relative mb-4">
                      {/* Bouncing call ring animations */}
                      {callState === 'calling' && (
                        <>
                          <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping pointer-events-none scale-105" />
                          <div className="absolute inset-0 bg-indigo-500/10 rounded-full animate-ping pointer-events-none scale-125" />
                        </>
                      )}
                      {callState === 'connected' && listeningState && (
                        <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full blur-md opacity-30 animate-pulse" />
                      )}
                      
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 border-4 border-slate-800 flex items-center justify-center font-bold text-3xl text-white shadow-xl relative z-10">
                        {activeCall.name[0]}
                      </div>
                    </div>

                    <h2 className="text-xl font-bold text-slate-100">{activeCall.name}</h2>
                    <p className="text-slate-400 text-sm mt-0.5">{activeCall.phone}</p>
                    
                    {/* Call Status Label */}
                    <div className="mt-3 text-sm font-semibold capitalize tracking-wide">
                      {callState === 'calling' && <span className="text-yellow-400">Calling...</span>}
                      {callState === 'connecting' && <span className="text-indigo-400 animate-pulse">Connecting...</span>}
                      {callState === 'connected' && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          Connected • {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Simulated Transcript Scroll Log */}
                  <div className="flex-1 px-6 py-2 overflow-y-auto space-y-3.5 border-t border-b border-slate-800/40 bg-slate-950/20">
                    {transcript.map((msg, index) => (
                      <motion.div 
                        key={index} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex flex-col ${msg.sender === 'ai' ? 'items-start' : 'items-end'}`}
                      >
                        <span className="text-[10px] text-slate-500 font-semibold mb-0.5 uppercase tracking-wide">
                          {msg.sender === 'ai' ? '🤖 AI Recruiter' : `👤 Student (${activeCall.name})`}
                        </span>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.sender === 'ai' 
                            ? 'bg-slate-900 text-slate-100 border border-slate-850 rounded-tl-sm' 
                            : 'bg-indigo-600/90 text-white rounded-tr-sm'
                        }`}>
                          {msg.text}
                        </div>
                      </motion.div>
                    ))}
                    
                    {/* Dynamic Sound Wave visualizer (Listening to student) */}
                    {callState === 'connected' && (
                      <div className="flex flex-col items-center justify-center py-6">
                        {listeningState ? (
                          <>
                            <span className="text-xs text-slate-500 font-medium tracking-wider animate-pulse mb-3 uppercase flex items-center gap-1.5">
                              <Mic size={12} className="text-emerald-400" />
                              Listening for response...
                            </span>
                            {/* Animated wave bars */}
                            <div className="flex items-center justify-center gap-1.5 h-8">
                              {[0.5, 0.8, 0.4, 0.9, 0.6, 0.85, 0.3].map((val, idx) => (
                                <motion.div
                                  key={idx}
                                  animate={{ height: ['25%', '90%', '25%'] }}
                                  transition={{
                                    repeat: Infinity,
                                    duration: 0.8 + idx * 0.1,
                                    ease: 'easeInOut'
                                  }}
                                  className="w-[3px] bg-gradient-to-t from-emerald-500 to-cyan-400 rounded-full"
                                  style={{ height: `${val * 100}%` }}
                                />
                              ))}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500 font-medium tracking-wider uppercase flex items-center gap-1.5">
                            <Volume2 size={12} className="text-indigo-400" />
                            AI Recruiter Speaking...
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Calling control pads & End Button */}
                  <div className="p-6 bg-slate-950/20 flex flex-col items-center">
                    {/* Dialer control row */}
                    <div className="flex justify-center gap-8 mb-6">
                      <button 
                        onClick={() => setIsMuted(!isMuted)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300 ${
                          isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <MicOff size={18} />
                      </button>
                      <button 
                        onClick={() => setIsSpeaker(!isSpeaker)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300 ${
                          isSpeaker ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Volume2 size={18} />
                      </button>
                      <button 
                        onClick={() => setIsKeypad(!isKeypad)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300 ${
                          isKeypad ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Grid size={18} />
                      </button>
                    </div>

                    <button 
                      onClick={handleEndCall}
                      className="w-16 h-16 bg-red-600 hover:bg-red-500 active:scale-95 rounded-full flex items-center justify-center text-white shadow-xl shadow-red-600/10 hover:shadow-red-600/30 hover:scale-105 transition-all duration-300"
                    >
                      <Phone size={24} className="rotate-[135deg] fill-white" />
                    </button>
                  </div>
                </>
              ) : (
                /* Simulated Call Completed Summary */
                <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
                  <div className="space-y-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} />
                    </div>
                    
                    <div>
                      <h2 className="text-2xl font-bold text-slate-100">Interview Completed</h2>
                      <p className="text-slate-400 text-sm mt-1">Automated AI voice screening has completed.</p>
                    </div>

                    {/* Stats table */}
                    <div className="bg-slate-950/50 border border-slate-850 rounded-2xl p-4 divide-y divide-slate-800/40 text-left">
                      <div className="flex justify-between py-2.5 text-sm">
                        <span className="text-slate-400">Call Duration</span>
                        <span className="text-slate-200 font-semibold">{Math.floor(callDuration / 60)}m {callDuration % 60}s</span>
                      </div>
                      <div className="flex justify-between py-2.5 text-sm">
                        <span className="text-slate-400">Questions Asked</span>
                        <span className="text-slate-200 font-semibold">5</span>
                      </div>
                      <div className="flex justify-between py-2.5 text-sm">
                        <span className="text-slate-400">Answers Logged</span>
                        <span className="text-slate-200 font-semibold">5</span>
                      </div>
                      <div className="flex justify-between py-2.5 text-sm">
                        <span className="text-slate-400">Transcript Status</span>
                        <span className="text-emerald-400 font-semibold">Generated</span>
                      </div>
                      <div className="flex justify-between py-2.5 text-sm">
                        <span className="text-slate-400">AI Match Score</span>
                        <span className="text-indigo-400 font-bold text-base">88/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mt-6">
                    <button 
                      onClick={() => handleDownloadPDF(activeCall.name)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white text-slate-200 font-semibold rounded-xl text-sm transition-all duration-300"
                    >
                      <Download size={16} />
                      Download Call Report
                    </button>
                    <button 
                      onClick={handleSaveAndCloseCall}
                      className="w-full py-3 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:scale-[1.02] text-white font-semibold rounded-xl text-sm transition-all duration-300 active:scale-100 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20"
                    >
                      Save & Close
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. REPORT DETAIL MODAL */}
      <AnimatePresence>
        {activeReport && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f1422] border border-slate-800/60 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-800/40 flex justify-between items-center bg-slate-950/20">
                <div className="flex items-center gap-2.5">
                  <FileText className="text-indigo-400" size={24} />
                  <h2 className="text-xl font-bold text-slate-100">Candidate Evaluation Report</h2>
                </div>
                <button 
                  onClick={() => setActiveReport(null)}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Report Body scrollbox */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {/* Meta details dashboard card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/40 border border-slate-850 rounded-2xl p-5">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Candidate Profile</span>
                    <div className="text-slate-100 font-bold text-base">{activeReport.name}</div>
                    <div className="text-slate-400 text-xs tracking-wide">{activeReport.phone}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Assessment Metrics</span>
                    <div className="text-slate-300 text-sm font-semibold flex items-center gap-1.5">
                      <Clock size={14} className="text-slate-400" />
                      Duration: {activeReport.duration}
                    </div>
                    <div className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                      <Calendar size={14} className="text-slate-400" />
                      Completed: {activeReport.date}
                    </div>
                  </div>
                  <div className="flex flex-col items-start md:items-end justify-center">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">AI Match Score</span>
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold text-lg">
                      <Award size={18} />
                      {activeReport.score}/100
                    </span>
                  </div>
                </div>

                {/* Structured QA Log */}
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-slate-300 flex items-center gap-2 border-b border-slate-800/40 pb-2">
                    <CheckCircle2 size={16} className="text-indigo-400" />
                    Interview Transcript & Captured Logs
                  </h3>
                  
                  {activeReport.answers && activeReport.answers.length > 0 ? (
                    activeReport.answers.map((log, index) => (
                      <div 
                        key={index} 
                        className={`p-4 border-l-4 rounded-r-2xl bg-slate-950/20 border-slate-800 ${
                          index >= 3 ? 'border-l-cyan-500/60 bg-cyan-950/5' : 'border-l-indigo-500/60 bg-indigo-950/5'
                        }`}
                      >
                        <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                          Question {index + 1}: {log.q}
                        </div>
                        <div className="text-slate-200 text-sm italic font-medium">
                          Answer: "{log.a}"
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 italic text-sm">No answers logged for this student.</div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-800/40 bg-slate-950/20 flex gap-4">
                <button 
                  onClick={() => handleDownloadPDF(activeReport.name)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:scale-[1.01] text-white font-semibold rounded-xl text-sm transition-all duration-300 shadow-md hover:shadow-indigo-500/10"
                >
                  <Download size={16} />
                  Download PDF Report
                </button>
                <button 
                  onClick={() => setActiveReport(null)}
                  className="px-6 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-200 font-semibold rounded-xl text-sm transition-colors duration-300"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Candidate Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f1422] border border-slate-800/60 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-100">Add New Student</h2>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddCandidate} className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Enter candidate name"
                    value={newCandidateName}
                    onChange={(e) => setNewCandidateName(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Verified Phone Number</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Enter phone number"
                    value={newCandidatePhone}
                    onChange={(e) => setNewCandidatePhone(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Must be verified in your Twilio trial account settings (with country code).</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:scale-[1.02] text-white font-semibold rounded-xl text-sm transition-all duration-300"
                  >
                    Save Student
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-3 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirm Delete Modal */}
      <AnimatePresence>
        {confirmDelete.show && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f1422] border border-slate-800/60 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={24} />
              </div>
              
              <h3 className="text-lg font-bold text-slate-100 mb-1">Delete Candidate</h3>
              <p className="text-slate-400 text-sm mb-6">
                Are you sure you want to delete <span className="text-indigo-400 font-semibold">{confirmDelete.candidateName}</span>? This action is permanent and will clear all MySQL logs.
              </p>

              <div className="flex gap-3">
                <button 
                  onClick={handleDeleteCandidate}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-semibold rounded-xl text-sm transition-all duration-300 shadow-md shadow-red-600/10"
                >
                  Yes, Delete
                </button>
                <button 
                  onClick={() => setConfirmDelete({ show: false, candidateId: null, candidateName: '' })}
                  className="flex-1 py-3 bg-slate-900 border border-slate-800 text-slate-355 hover:text-white rounded-xl text-sm transition-colors duration-300"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification Banner */}
      <AnimatePresence>
        {toast.show && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl border text-sm font-semibold tracking-wide backdrop-blur-md ${
              toast.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : toast.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 size={16} />}
            {toast.type === 'error' && <AlertCircle size={16} />}
            {toast.type === 'info' && <Info size={16} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
