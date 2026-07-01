import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Folder, 
  Mail, 
  Calendar as CalendarIcon, 
  BookOpen, 
  X, 
  MessageSquare, 
  ExternalLink,
  ChevronRight,
  Loader2,
  Sparkles
} from 'lucide-react';

interface GlobalSearchProps {
  accessToken: string | null;
  userId: string | null;
  onAttachToChat: (item: any) => void;
  onSwitchTab: (tabId: any) => void;
}

export default function GlobalSearch({ accessToken, userId, onAttachToChat, onSwitchTab }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Search results lists
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search trigger on debounce
  useEffect(() => {
    if (!query.trim()) {
      setDriveFiles([]);
      setEmails([]);
      setEvents([]);
      setNotes([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);

    const timer = setTimeout(async () => {
      try {
        const promises: Promise<any>[] = [];

        if (accessToken) {
          // 1. Search Google Drive
          const driveUrl = `https://www.googleapis.com/drive/v3/files?q=name+contains+'${encodeURIComponent(query)}'+and+trashed=false&pageSize=4&fields=files(id,name,mimeType,webViewLink)`;
          promises.push(
            fetch(driveUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
              .then(res => res.ok ? res.json() : { files: [] })
              .then(data => setDriveFiles(data.files || []))
              .catch(() => setDriveFiles([]))
          );

          // 2. Search Gmail
          const gmailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=4`;
          promises.push(
            fetch(gmailUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
              .then(res => res.ok ? res.json() : { messages: [] })
              .then(async (data) => {
                const msgs = data.messages || [];
                // Gather snippets
                const detailedMsgs = await Promise.all(
                  msgs.map(async (m: any) => {
                    const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?fields=id,snippet,payload(headers)`;
                    const detailRes = await fetch(detailUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
                    if (detailRes.ok) {
                      const detailData = await detailRes.json();
                      const headers = detailData.payload?.headers || [];
                      const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
                      const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
                      return { id: m.id, snippet: detailData.snippet, subject, from };
                    }
                    return { id: m.id, snippet: 'Email message matched query', subject: 'Gmail Message' };
                  })
                );
                setEmails(detailedMsgs);
              })
              .catch(() => setEmails([]))
          );

          // 3. Search Calendar Events
          const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${encodeURIComponent(query)}&maxResults=4`;
          promises.push(
            fetch(calendarUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
              .then(res => res.ok ? res.json() : { items: [] })
              .then(data => setEvents(data.items || []))
              .catch(() => setEvents([]))
          );
        }

        // 4. Search Firestore Notes locally (or quick Firestore query)
        // We can do a fetch for Firestore if desired, but since notes are fetched in App, we can also query notes index or provide local fallback.
        // Let's do a fast local search in IndexedDB/LocalStorage fallback notes or placeholder
        const localData = localStorage.getItem('google_keep_fallback_notes');
        if (localData) {
          const rawNotes = JSON.parse(localData);
          const filtered = rawNotes.filter((n: any) => 
            (n.title && n.title.toLowerCase().includes(query.toLowerCase())) || 
            (n.body?.text?.text && n.body.text.text.toLowerCase().includes(query.toLowerCase()))
          );
          setNotes(filtered.slice(0, 3));
        }

        await Promise.all(promises);
      } catch (err) {
        console.error('Omni-search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(timer);
  }, [query, accessToken]);

  const hasResults = driveFiles.length > 0 || emails.length > 0 || events.length > 0 || notes.length > 0;

  return (
    <div className="relative w-full max-w-2xl mx-auto" ref={resultsRef}>
      {/* Search Bar Wrapper */}
      <div className="relative flex items-center bg-white border border-gray-250 hover:border-gray-350 focus-within:ring-2 focus-within:ring-blue-500/25 focus-within:border-blue-600 rounded-xl transition-all shadow-xs pr-3 pl-4 py-2.5">
        <Search className="w-4 h-4 text-gray-400 shrink-0 mr-2" />
        <input
          type="text"
          placeholder="Global Workspace Search (e.g., search emails, sheets, agendas, files)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          className="w-full text-xs font-semibold focus:outline-none text-gray-800 placeholder-gray-400 bg-transparent border-none p-0"
        />
        {query && (
          <button 
            onClick={() => {
              setQuery('');
              setShowResults(false);
            }} 
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dynamic Results Overlay */}
      {showResults && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50 animate-fade-in max-h-[480px] overflow-y-auto">
          {isSearching && (
            <div className="p-4 flex items-center justify-center gap-2 text-xs text-gray-500 bg-gray-50/50">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Scanning unified Workspace...</span>
            </div>
          )}

          {!isSearching && !hasResults && (
            <div className="p-8 text-center text-xs text-gray-400">
              No results found across Drive, Gmail, Calendar, or Notes.
            </div>
          )}

          {/* Results categorized list */}
          {!isSearching && hasResults && (
            <div className="divide-y divide-gray-100 p-2 space-y-3">
              {/* Category: Drive */}
              {driveFiles.length > 0 && (
                <div className="space-y-1 p-1">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest px-2.5 flex items-center gap-1">
                    <Folder className="w-3.5 h-3.5" />
                    Google Drive Files
                  </span>
                  <div className="space-y-0.5">
                    {driveFiles.map(file => (
                      <div key={file.id} className="p-2 hover:bg-gray-50 rounded-lg text-xs flex items-center justify-between group">
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="font-bold text-gray-800 truncate">{file.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{file.mimeType}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              onAttachToChat(file);
                              setShowResults(false);
                              setQuery('');
                            }}
                            className="p-1 hover:bg-blue-50 text-blue-600 rounded"
                            title="Discuss with Co-Pilot"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          {file.webViewLink && (
                            <a href={file.webViewLink} target="_blank" rel="noopener" className="p-1 hover:bg-gray-100 text-gray-500 rounded">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category: Gmail */}
              {emails.length > 0 && (
                <div className="space-y-1 p-1 pt-2">
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-2.5 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    Gmail Messages
                  </span>
                  <div className="space-y-0.5">
                    {emails.map(email => (
                      <div key={email.id} className="p-2 hover:bg-gray-50 rounded-lg text-xs flex items-center justify-between group">
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="font-bold text-gray-800 truncate">{email.subject}</p>
                          <p className="text-[10px] text-gray-500 truncate font-semibold">From: {email.from}</p>
                          <p className="text-[10px] text-gray-400 truncate italic">{email.snippet}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              onAttachToChat({ id: email.id, title: email.subject, snippet: email.snippet, mimeType: 'email' });
                              setShowResults(false);
                              setQuery('');
                            }}
                            className="p-1 hover:bg-red-50 text-red-600 rounded"
                            title="Discuss with Co-Pilot"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category: Calendar */}
              {events.length > 0 && (
                <div className="space-y-1 p-1 pt-2">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest px-2.5 flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    Calendar Agendas
                  </span>
                  <div className="space-y-0.5">
                    {events.map(event => (
                      <div key={event.id} className="p-2 hover:bg-gray-50 rounded-lg text-xs flex items-center justify-between group">
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="font-bold text-gray-800 truncate">{event.summary}</p>
                          <p className="text-[10px] text-gray-400">
                            {event.start?.dateTime ? new Date(event.start.dateTime).toLocaleString() : 'All day event'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              onAttachToChat({ id: event.id, title: event.summary, mimeType: 'calendar-event' });
                              setShowResults(false);
                              setQuery('');
                            }}
                            className="p-1 hover:bg-indigo-50 text-indigo-600 rounded"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category: Notes */}
              {notes.length > 0 && (
                <div className="space-y-1 p-1 pt-2">
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest px-2.5 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    Personal Notes
                  </span>
                  <div className="space-y-0.5">
                    {notes.map(note => (
                      <div key={note.name} className="p-2 hover:bg-gray-50 rounded-lg text-xs flex items-center justify-between group">
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="font-bold text-gray-800 truncate">{note.title || 'Untitled note'}</p>
                          <p className="text-[10px] text-gray-400 truncate">{note.body?.text?.text || note.snippet}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              onAttachToChat({ title: note.title, content: note.body?.text?.text || note.snippet, mimeType: 'keep-note' });
                              setShowResults(false);
                              setQuery('');
                            }}
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
