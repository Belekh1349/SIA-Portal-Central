import React, { useState, useEffect, useMemo } from 'react';
import {
    Bell, CheckSquare, FileText, Calendar, Plus, User, LogOut, Settings, Info,
    ChevronRight, ExternalLink, Search, MessageSquare, Image as ImageIcon,
    Clock, Presentation, Sparkles, Send, Loader2, Mail, CheckCircle2,
    AlertCircle, FileSearch, Zap, Upload, File, X, Users, Filter, ArrowRight,
    Menu, Moon, Sun, MoreVertical, Trash2, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from 'firebase/auth';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyAHI5_yqSRwhLGcXYdvTfZANDt_iWQ-K_M",
    authDomain: "sia-control.firebaseapp.com",
    projectId: "sia-control",
    storageBucket: "sia-control.firebasestorage.app",
    messagingSenderId: "933718961367",
    appId: "1:933718961367:web:2cbae344c58b3bbccdd492",
    measurementId: "G-3XP86VY2B4"
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'pizarra-v2';

// --- INTEGRACIÓN GEMINI API ---
const apiKey = ""; // La API Key debería venir de una variable de entorno idealmente

const callGemini = async (prompt, systemInstruction = "") => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Lo siento, tuve un problema conectando con mi cerebro digital. ¿Podemos intentar de nuevo?";
    }
};

// --- COMPONENTES AUXILIARES ---

const Card = ({ children, className = "" }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 ${className}`}
    >
        {children}
    </motion.div>
);

const Badge = ({ children, variant = "default" }) => {
    const styles = {
        default: "bg-slate-100 text-slate-600",
        success: "bg-emerald-100 text-emerald-600",
        warning: "bg-amber-100 text-amber-600",
        danger: "bg-rose-100 text-rose-600",
        indigo: "bg-indigo-100 text-indigo-600"
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[variant]}`}>
            {children}
        </span>
    );
};

export default function App() {
    const [activeTab, setActiveTab] = useState('inicio');
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Estados de IA y Carga
    const [aiLoading, setAiLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [notification, setNotification] = useState(null);

    // Estados de Formulario
    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [notifyStaff, setNotifyStaff] = useState(true);

    // Estados de Datos
    const [announcements, setAnnouncements] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [events, setEvents] = useState([]);

    // Chat Asistente
    const [chatMessages, setChatMessages] = useState([
        { role: 'assistant', text: '¡Hola! Soy tu asistente de Pizarra Plus ✨. ¿En qué puedo ayudarte a organizar hoy?' }
    ]);
    const [chatInput, setChatInput] = useState('');

    // --- EFECTOS ---

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (!u) {
                signInAnonymously(auth).catch(console.error);
            }
        });

        // Carga de datos con Firebase Firestore
        const loadData = () => {
            const paths = {
                announcements: collection(db, 'artifacts', appId, 'public', 'data', 'announcements'),
                tasks: collection(db, 'artifacts', appId, 'public', 'data', 'tasks'),
                documents: collection(db, 'artifacts', appId, 'public', 'data', 'documents'),
                events: collection(db, 'artifacts', appId, 'public', 'data', 'events')
            };

            const unsubs = Object.entries(paths).map(([key, ref]) => {
                return onSnapshot(query(ref, orderBy('createdAt', 'desc')), (snapshot) => {
                    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    if (key === 'announcements') setAnnouncements(data);
                    if (key === 'tasks') setTasks(data);
                    if (key === 'documents') setDocuments(data);
                    if (key === 'events') setEvents(data);
                });
            });

            return () => unsubs.forEach(fn => fn());
        };

        const cleanup = loadData();
        return () => { unsubscribe(); cleanup(); };
    }, []);

    // --- LÓGICA DE FILTRADO Y BÚSQUEDA ---
    const filteredData = useMemo(() => {
        const q = searchQuery.toLowerCase();

        const filterBySearch = (item) =>
            item.title?.toLowerCase().includes(q) ||
            item.content?.toLowerCase().includes(q) ||
            item.assignedTo?.toLowerCase().includes(q);

        switch (activeTab) {
            case 'inicio': return announcements.filter(filterBySearch);
            case 'tareas':
                return tasks.filter(t => {
                    const matchesSearch = filterBySearch(t);
                    if (filterType === 'all') return matchesSearch;
                    return matchesSearch && t.status === filterType;
                });
            case 'documentos': return documents.filter(filterBySearch);
            case 'calendario': return events.filter(filterBySearch);
            default: return [];
        }
    }, [activeTab, searchQuery, filterType, announcements, tasks, documents, events]);

    // --- ACCIONES IA ---

    const handleAIDraft = async (type) => {
        if (!formTitle) return;
        setAiLoading(true);
        let prompt = "";
        switch (type) {
            case 'inicio': prompt = `Crea un comunicado corporativo inspirador: "${formTitle}"`; break;
            case 'tareas': prompt = `Pasos detallados para realizar: "${formTitle}"`; break;
            case 'documentos': prompt = `Resumen ejecutivo profesional para el archivo: "${formTitle}"`; break;
            default: prompt = `Ayúdame con info sobre: "${formTitle}"`;
        }

        const response = await callGemini(prompt, "Eres un redactor corporativo Senior.");
        setFormContent(response || "");
        setAiLoading(false);
    };

    const handleChatSubmit = async (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        const userMsg = { role: 'user', text: chatInput };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setAiLoading(true);
        const resp = await callGemini(chatInput, "Asistente experto de la app Pizarra Plus.");
        setChatMessages(prev => [...prev, { role: 'assistant', text: resp }]);
        setAiLoading(false);
    };

    const showToast = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        setIsUploading(true);

        // Simulación de carga
        if (selectedFile) {
            for (let i = 0; i <= 100; i += 25) {
                setUploadProgress(i);
                await new Promise(r => setTimeout(r, 150));
            }
        }

        const data = {
            title: formTitle,
            content: formContent,
            createdAt: new Date().toISOString(),
            author: user?.uid || 'anon',
            ...(activeTab === 'tareas' && { status: 'pendiente', priority: e.target.priority?.value || 'normal', assignedTo: e.target.assignedTo?.value }),
            ...(activeTab === 'documentos' && { fileName: selectedFile?.name, fileSize: (selectedFile?.size / 1024).toFixed(1) + ' KB' }),
            ...(activeTab === 'calendario' && { date: e.target.date?.value, time: e.target.time?.value })
        };

        try {
            let coll = activeTab === 'inicio' ? 'announcements' : activeTab;
            if (coll === 'calendario') coll = 'events';
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', coll), data);
            showToast('¡Fijado en la pizarra con éxito!');
            setShowAddModal(false);
            setFormTitle('');
            setFormContent('');
            setSelectedFile(null);
        } catch (err) {
            showToast('Error al guardar', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const toggleTask = async (task) => {
        const newStatus = task.status === 'completada' ? 'pendiente' : 'completada';
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', task.id), { status: newStatus });
        } catch (e) { console.error(e); }
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">

            {/* Toast */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border ${notification.type === 'success' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-rose-600 border-rose-500 text-white'}`}
                    >
                        {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="font-bold text-sm tracking-wide">{notification.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sidebar Desktop */}
            <aside className={`fixed lg:relative z-40 h-full w-72 bg-premium-dark text-white p-6 transition-transform duration-500 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="flex items-center gap-4 mb-12">
                    <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Presentation className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tighter">PIZARRA<span className="text-indigo-400">PLUS</span></h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Workspace Agent</p>
                    </div>
                </div>

                <nav className="space-y-2">
                    {[
                        { id: 'inicio', icon: Bell, label: 'Comunicados' },
                        { id: 'tareas', icon: CheckSquare, label: 'Flujo de Tareas' },
                        { id: 'documentos', icon: FileText, label: 'Biblioteca' },
                        { id: 'calendario', icon: Calendar, label: 'Eventos' },
                        { id: 'asistente', icon: Sparkles, label: 'Asistente IA', premium: true }
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                            className={`w-full sidebar-link ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
                        >
                            <item.icon className={`w-5 h-5 ${item.premium && activeTab !== item.id ? 'text-indigo-400' : ''}`} />
                            <span className="font-semibold text-sm">{item.label}</span>
                            {activeTab === item.id && <motion.div layoutId="activeInd" className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
                        </button>
                    ))}
                </nav>

                <div className="absolute bottom-10 left-6 right-6">
                    <div className="p-4 rounded-3xl bg-slate-800/40 border border-slate-700/50">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-xs">U</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">Invitado</p>
                                <p className="text-[10px] text-slate-500">Sesión Activa</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsAdmin(!isAdmin)}
                            className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${isAdmin ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                        >
                            {isAdmin ? 'Admin Mode (On)' : 'Unlock Admin'}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Container */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden mesh-gradient">

                {/* Top Header */}
                <header className="h-20 flex items-center justify-between px-8 bg-white/30 backdrop-blur-md border-b border-white/50 z-30">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-600"><Menu /></button>
                        <h2 className="text-2xl font-black text-slate-800 capitalize tracking-tight">{activeTab === 'inicio' ? 'Mural' : activeTab}</h2>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar en la pizarra..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-12 pr-6 py-2.5 bg-white border-none rounded-2xl w-64 shadow-sm focus:ring-2 focus:ring-indigo-500/20 text-sm outline-none transition-all"
                            />
                        </div>
                        {isAdmin && activeTab !== 'asistente' && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                <span className="hidden sm:inline">Nueva Entrada</span>
                            </button>
                        )}
                    </div>
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-8 space-y-8">

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab + searchQuery + filterType}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >

                            {/* VISTA: INICIO / COMUNICADOS */}
                            {activeTab === 'inicio' && (
                                <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto">
                                    {filteredData.map((item, idx) => (
                                        <Card key={item.id} className="relative overflow-hidden">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <Badge variant="indigo">Comunicado</Badge>
                                                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold"><Clock className="w-3 h-3" /> {new Date(item.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <h3 className="text-2xl font-black text-slate-800 mb-3 leading-tight">{item.title}</h3>
                                                    <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-wrap">{item.content}</p>
                                                </div>
                                                <div className="ml-4 w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                                    <Bell className="w-6 h-6" />
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                    {filteredData.length === 0 && <div className="text-center py-20 text-slate-400 font-bold italic opacity-50">Silencio en el mural...</div>}
                                </div>
                            )}

                            {/* VISTA: TAREAS */}
                            {activeTab === 'tareas' && (
                                <div className="max-w-5xl mx-auto space-y-6">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-2 bg-white/50 p-1 rounded-2xl border border-white">
                                            {['all', 'pendiente', 'completada'].map(f => (
                                                <button
                                                    key={f}
                                                    onClick={() => setFilterType(f)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${filterType === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {f === 'all' ? 'Todas' : f}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {filteredData.map(task => (
                                            <Card key={task.id} className={`border-l-4 ${task.status === 'completada' ? 'border-l-emerald-500 grayscale-[0.5]' : 'border-l-indigo-500'}`}>
                                                <div className="flex items-start gap-4">
                                                    <button
                                                        onClick={() => toggleTask(task)}
                                                        className={`mt-1 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${task.status === 'completada' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-indigo-400'}`}
                                                    >
                                                        {task.status === 'completada' && <CheckCircle2 className="w-5 h-5" />}
                                                    </button>
                                                    <div className="flex-1">
                                                        <h4 className={`text-lg font-bold ${task.status === 'completada' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</h4>
                                                        <div className="flex gap-2 my-2">
                                                            <Badge variant={task.priority === 'alta' ? 'danger' : 'default'}>{task.priority || 'Normal'}</Badge>
                                                            {task.assignedTo && <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1"><Users className="w-3 h-3" /> {task.assignedTo}</span>}
                                                        </div>
                                                        <p className="text-sm text-slate-500">{task.content}</p>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* VISTA: DOCUMENTOS */}
                            {activeTab === 'documentos' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredData.map(doc => (
                                        <Card key={doc.id} className="group cursor-pointer">
                                            <div className="bg-slate-50 rounded-2xl h-40 flex items-center justify-center mb-4 transition-colors group-hover:bg-indigo-50">
                                                <FileSearch className="w-12 h-12 text-slate-300 group-hover:text-indigo-400 transition-all transform group-hover:scale-110" />
                                            </div>
                                            <h4 className="font-bold text-slate-800 truncate mb-1">{doc.title}</h4>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{doc.fileSize || 'Desconocido'}</p>
                                            <div className="mt-4 flex gap-2">
                                                <button className="flex-1 py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-xl active:scale-95 transition-all">Ver Ahora</button>
                                                <button className="w-10 h-10 border border-slate-100 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-400"><ExternalLink className="w-4 h-4" /></button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {/* VISTA: CALENDARIO */}
                            {activeTab === 'calendario' && (
                                <div className="max-w-4xl mx-auto space-y-4">
                                    {filteredData.map(event => (
                                        <Card key={event.id} className="flex gap-8 group">
                                            <div className="w-20 h-24 bg-premium-dark rounded-3xl flex flex-col items-center justify-center text-white shadow-xl transform transition-transform group-hover:rotate-2">
                                                <span className="text-[10px] font-black opacity-50 uppercase tracking-widest">{new Date(event.date).toLocaleString('es-ES', { month: 'short' })}</span>
                                                <span className="text-3xl font-black">{new Date(event.date).getDate()}</span>
                                            </div>
                                            <div className="flex-1 py-1">
                                                <h3 className="text-xl font-black text-slate-800 mb-2">{event.title}</h3>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xs font-bold text-indigo-500 flex items-center gap-1.5 bg-indigo-50 px-3 py-1 rounded-full"><Clock className="w-4 h-4" /> {event.time}</span>
                                                </div>
                                                <p className="mt-4 text-sm text-slate-400 leading-relaxed italic">{event.content}</p>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {/* VISTA: ASISTENTE IA */}
                            {activeTab === 'asistente' && (
                                <div className="max-w-4xl mx-auto h-[75vh] flex flex-col glass-card rounded-[40px] overflow-hidden border-indigo-200">
                                    <div className="p-6 bg-indigo-600 text-white flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-white/20 rounded-xl"><Sparkles className="w-6 h-6" /></div>
                                            <div>
                                                <h3 className="font-black tracking-tight">Cerebro Digital Pizarra</h3>
                                                <p className="text-[10px] font-bold opacity-60">IA impulsada por Gemini 2.0 Flash</p>
                                            </div>
                                        </div>
                                        <Badge variant="success">Online</Badge>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                        {chatMessages.map((msg, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div className={`max-w-[80%] p-5 rounded-3xl shadow-sm text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none font-medium'}`}>
                                                    {msg.text}
                                                </div>
                                            </motion.div>
                                        ))}
                                        {aiLoading && <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity }} className="w-12 h-8 bg-slate-100 rounded-full flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-indigo-600" /></motion.div>}
                                    </div>

                                    <form onSubmit={handleChatSubmit} className="p-6 bg-white border-t border-slate-100 flex gap-3">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            placeholder="Pregunta lo que sea sobre el trabajo..."
                                            className="flex-1 bg-slate-50 border-none rounded-2xl px-6 outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
                                        />
                                        <button type="submit" disabled={aiLoading || !chatInput.trim()} className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-600/20 active:scale-90 transition-all">
                                            <Send className="w-6 h-6" />
                                        </button>
                                    </form>
                                </div>
                            )}

                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>

            {/* MODAL MODERNO */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAddModal(false)}
                            className="absolute inset-0 bg-premium-dark/80 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
                        >
                            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800">Nueva Entrada</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Publicando en {activeTab}</p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-rose-500 transition-colors"><X /></button>
                            </div>

                            <form onSubmit={handleAddItem} className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">

                                {activeTab === 'documentos' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Archivo / Documento</label>
                                        <div className="relative group overflow-hidden bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 transition-all hover:border-indigo-400 hover:bg-indigo-50/50">
                                            <input type="file" onChange={(e) => { setSelectedFile(e.target.files[0]); if (!formTitle) setFormTitle(e.target.files[0]?.name.split('.')[0]); }} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                            <div className="flex flex-col items-center gap-2 text-center">
                                                <Upload className="w-10 h-10 text-indigo-400 group-hover:scale-110 transition-transform" />
                                                <p className="text-xs font-bold text-slate-600">{selectedFile ? selectedFile.name : 'Suelta archivos o haz clic para subir'}</p>
                                            </div>
                                            {isUploading && <motion.div className="absolute bottom-0 left-0 h-1 bg-indigo-600" animate={{ width: `${uploadProgress}%` }} />}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Título de la Entrada</label>
                                    <div className="relative">
                                        <input
                                            name="title"
                                            required
                                            value={formTitle}
                                            onChange={(e) => setFormTitle(e.target.value)}
                                            className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            placeholder="Ej: Reporte Mensual Q1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAIDraft(activeTab)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                        >
                                            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} IA Draft
                                        </button>
                                    </div>
                                </div>

                                {activeTab === 'tareas' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Responsable</label>
                                            <input name="assignedTo" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3 text-sm font-bold" placeholder="Nombre..." />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Urgencia</label>
                                            <select name="priority" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3 text-sm font-bold appearance-none">
                                                <option value="normal">⚡ Normal</option>
                                                <option value="alta">🔥 Urgente</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'calendario' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Fecha</label>
                                            <input name="date" type="date" required className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3 text-sm font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Hora</label>
                                            <input name="time" type="time" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3 text-sm font-bold" />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cuerpo / Detalles</label>
                                    <textarea
                                        name="content"
                                        rows="4"
                                        value={formContent}
                                        onChange={(e) => setFormContent(e.target.value)}
                                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm leading-relaxed text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        placeholder="Describe los detalles aquí..."
                                    />
                                </div>

                                <div className="p-6 bg-slate-50 rounded-3xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Mail className="w-4 h-4" /></div>
                                        <span className="text-xs font-bold text-slate-700">Notificar por Email</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={notifyStaff}
                                        onChange={(e) => setNotifyStaff(e.target.checked)}
                                        className="w-5 h-5 rounded-lg text-indigo-600 focus:ring-indigo-500"
                                    />
                                </div>

                                <button
                                    disabled={isUploading || aiLoading}
                                    className="w-full bg-premium-dark text-white py-5 rounded-3xl font-black text-lg tracking-tight shadow-2xl hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {isUploading ? <Loader2 className="animate-spin" /> : <Send />}
                                    {isUploading ? 'Procesando...' : 'Fijar en Pizarra'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Mobile Nav */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 p-4 pb-8 flex justify-around z-40">
                {[
                    { id: 'inicio', icon: Bell },
                    { id: 'tareas', icon: CheckSquare },
                    { id: 'asistente', icon: Sparkles },
                    { id: 'calendario', icon: Calendar },
                    { id: 'documentos', icon: FileText }
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`p-3 rounded-2xl transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
                    >
                        <item.icon className="w-6 h-6" />
                    </button>
                ))}
            </nav>

        </div>
    );
}
