import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logoutUser } from './lib/firebase';
import DriveTab from './components/DriveTab';
import GmailTab from './components/GmailTab';
import CalendarTab from './components/CalendarTab';
import TasksTab from './components/TasksTab';
import ContactsTab from './components/ContactsTab';
import NotesTab from './components/NotesTab';
import SuiteTab from './components/SuiteTab';
import ChatPanel from './components/ChatPanel';
import GlobalSearch from './components/GlobalSearch';
import { 
  Folder, 
  Mail, 
  Calendar, 
  CheckSquare, 
  Users, 
  BookOpen, 
  LogOut, 
  Sparkles,
  Layout,
  Layers,
  ChevronRight,
  ShieldCheck,
  Keyboard
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'drive' | 'gmail' | 'calendar' | 'tasks' | 'contacts' | 'notes' | 'suite'>('drive');
  const [attachedItem, setAttachedItem] = useState<any>(null);

  useEffect(() => {
    // Initialize Auth state listener on load
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Keyboard Shortcuts for switching between tabs (Alt+Number or Ctrl+Number)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Switch tab on Alt+Number or Ctrl+Number or Cmd+Number
      if ((e.altKey || e.ctrlKey || e.metaKey) && !isNaN(Number(e.key))) {
        const keyNum = Number(e.key);
        const tabs: ('drive' | 'gmail' | 'calendar' | 'tasks' | 'contacts' | 'notes' | 'suite')[] = [
          'drive',
          'gmail',
          'calendar',
          'tasks',
          'contacts',
          'notes',
          'suite'
        ];
        
        if (keyNum >= 1 && keyNum <= tabs.length) {
          e.preventDefault();
          setActiveTab(tabs[keyNum - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Google sign-in failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = window.confirm('Are you sure you want to sign out?');
    if (!confirmed) return;

    try {
      await logoutUser();
      setUser(null);
      setToken(null);
      setAttachedItem(null);
      setNeedsAuth(true);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleAttachToChat = (item: any) => {
    setAttachedItem(item);
    // Visual cue: blink or scroll chat to grab user focus if screen is small
    const chatContainer = document.getElementById('chat-panel');
    if (chatContainer) {
      chatContainer.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-between font-sans">
        {/* Top Navbar */}
        <header className="border-b border-gray-100 bg-white/80 backdrop-blur px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-bold text-gray-900 tracking-tight text-sm sm:text-base">Personal Workspace Assistant</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Secure Enterprise Auth</span>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 max-w-4xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100">
              <Layers className="w-3.5 h-3.5" />
              Unified Workspace Dashboard
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight max-w-2xl">
              Access all your files & chat with your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">personal data</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-500 max-w-xl mx-auto leading-relaxed">
              Connect Google Drive, Gmail, Google Calendar, Tasks, and Contacts. Get a custom secure database for personal Keep notes, and query everything in real-time with our agentic Gemini co-pilot.
            </p>
          </div>

          {/* Sign In Button Container */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 max-w-md w-full">
            <h3 className="font-bold text-gray-800 text-sm">Sign in to initialize Workspace</h3>
            
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 border border-gray-200 hover:border-gray-300 bg-white py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all font-semibold text-gray-700 hover:bg-gray-50/50 disabled:opacity-50 cursor-pointer"
            >
              {isLoggingIn ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span className="text-sm">Sign in with Google</span>
                </>
              )}
            </button>

            <p className="text-[10px] text-gray-400">
              Only readonly access is granted to your files and emails. No data is stored outside your sandbox and Firebase project.
            </p>
          </div>

          {/* Feature Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-3xl pt-4">
            {[
              { label: 'Google Drive', detail: 'View, search, & analyze files' },
              { label: 'Gmail', detail: 'Summarize latest inbox' },
              { label: 'Google Calendar', detail: 'Track schedule & agendas' },
              { label: 'Google Tasks', detail: 'Add & check off items' },
              { label: 'Google Contacts', detail: 'Fetch profiles & emails' },
              { label: 'Cloud Firestore Notes', detail: 'Durable personal keep synced' },
            ].map((f, idx) => (
              <div key={idx} className="bg-white p-3.5 rounded-xl border border-gray-100 text-left space-y-1">
                <p className="font-bold text-xs text-gray-800">{f.label}</p>
                <p className="text-[10px] text-gray-400 font-medium leading-normal">{f.detail}</p>
              </div>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-100 py-6 text-center text-[11px] text-gray-400">
          <p>© 2026 Workspace Personal Assistant. Made securely with Google Gemini & Firebase Auth.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800">
      {/* Active User Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-sm shrink-0">
            <Layout className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-gray-900 tracking-tight text-xs sm:text-base leading-tight">
              Workspace Assistant
            </h1>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider hidden sm:block">Unified Personal Suite</p>
          </div>
        </div>

        {/* User profile & Logout */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2 border border-gray-100 bg-gray-50/50 rounded-full py-1 pl-1.5 pr-3.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-7 h-7 rounded-full border border-gray-200 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 bg-blue-600 text-white font-bold rounded-full text-xs flex items-center justify-center">
                  {user.displayName?.charAt(0) || 'U'}
                </div>
              )}
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-gray-700 leading-tight">
                  {user.displayName || 'Workspace User'}
                </p>
                <p className="text-[9px] text-gray-400 truncate max-w-[120px]">
                  {user.email}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            title="Sign out of account"
            className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 border border-gray-100 hover:border-red-150 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Main Suite Split Layout */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 overflow-hidden">
        {/* Workspace Hub Column (Tab content on Left) */}
        <div className="xl:col-span-2 p-4 sm:p-6 overflow-y-auto space-y-6">
          
          {/* Global Omni Search Bar */}
          <GlobalSearch 
            accessToken={token} 
            userId={user ? user.uid : null} 
            onAttachToChat={handleAttachToChat}
            onSwitchTab={(tabId) => setActiveTab(tabId)}
          />

          {/* Main Navigation Tabs */}
          <nav className="flex items-center overflow-x-auto pb-1 gap-1 border-b border-gray-200">
            {[
              { id: 'drive', label: 'My Drive', icon: Folder, color: 'text-blue-500' },
              { id: 'gmail', label: 'My Gmail', icon: Mail, color: 'text-red-500' },
              { id: 'calendar', label: 'My Calendar', icon: Calendar, color: 'text-indigo-500' },
              { id: 'tasks', label: 'My Tasks', icon: CheckSquare, color: 'text-emerald-500' },
              { id: 'contacts', label: 'Contacts', icon: Users, color: 'text-amber-500' },
              { id: 'notes', label: 'My Notes', icon: BookOpen, color: 'text-rose-500' },
              { id: 'suite', label: 'Google Suite', icon: Layers, color: 'text-purple-500' },
            ].map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                    isActive 
                      ? 'border-blue-600 text-blue-700 bg-blue-50/20 shadow-xs font-bold' 
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50'
                  }`}
                  title={`Switch to tab (Alt+${idx + 1})`}
                >
                  <Icon className={`w-4 h-4 ${tab.color}`} />
                  {tab.label}
                  <span className="hidden md:inline text-[9px] bg-gray-100 text-gray-400 px-1 py-0.5 rounded ml-1 font-mono">
                    ⌥{idx + 1}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Keyboard shortcut tips bar */}
          <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-150 flex items-center justify-between text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-gray-400" />
              Keyboard Navigation Ready
            </span>
            <span>Shortcut keys: Alt + [1 to 7]</span>
          </div>

          {/* Content panel matching the active tab */}
          <div className="focus:outline-none">
            {activeTab === 'drive' && token && (
              <DriveTab accessToken={token} onAttachToChat={handleAttachToChat} />
            )}
            {activeTab === 'gmail' && token && (
              <GmailTab accessToken={token} onAttachToChat={handleAttachToChat} />
            )}
            {activeTab === 'calendar' && token && (
              <CalendarTab accessToken={token} onAttachToChat={handleAttachToChat} />
            )}
            {activeTab === 'tasks' && token && (
              <TasksTab accessToken={token} onAttachToChat={handleAttachToChat} />
            )}
            {activeTab === 'contacts' && token && (
              <ContactsTab accessToken={token} onAttachToChat={handleAttachToChat} />
            )}
            {activeTab === 'notes' && user && (
              <NotesTab userId={user.uid} onAttachToChat={handleAttachToChat} />
            )}
            {activeTab === 'suite' && token && (
              <SuiteTab accessToken={token} onAttachToChat={handleAttachToChat} />
            )}
          </div>
        </div>

        {/* Co-Pilot Column (Chat on Right) */}
        <div className="xl:col-span-1 border-t xl:border-t-0 xl:border-l border-gray-200 p-4 sm:p-6 bg-white flex flex-col justify-between h-[600px] xl:h-[calc(100vh-65px)] sticky top-[65px]">
          <ChatPanel 
            accessToken={token} 
            attachedItem={attachedItem} 
            onClearAttachedItem={() => setAttachedItem(null)} 
          />
        </div>
      </div>
    </div>
  );
}
