import React, { useState, useEffect, useRef } from 'react';
import { PersonalNote } from '../types';
import { subscribeToNotes, createNote, updateNote, deleteNote } from '../lib/notes';
import { FileText, Plus, Trash2, Edit2, Check, X, MessageSquare, CloudLightning, RefreshCw, CheckCircle2 } from 'lucide-react';

interface NotesTabProps {
  userId: string;
  onAttachToChat: (note: PersonalNote) => void;
}

export default function NotesTab({ userId, onAttachToChat }: NotesTabProps) {
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  // Note Form State (for Create & Edit)
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Auto-save states
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSavedValues = useRef({ title: '', content: '' });

  // Soft aesthetic background colors for notes
  const NOTE_BG_CLASSES = [
    'bg-rose-50 border-rose-100 text-rose-900',
    'bg-amber-50 border-amber-100 text-amber-900',
    'bg-emerald-50 border-emerald-100 text-emerald-900',
    'bg-teal-50 border-teal-100 text-teal-900',
    'bg-sky-50 border-sky-100 text-sky-900',
    'bg-indigo-50 border-indigo-100 text-indigo-900',
    'bg-fuchsia-50 border-fuchsia-100 text-fuchsia-900',
  ];

  const getNoteColorIndex = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % NOTE_BG_CLASSES.length;
  };

  // Subscribe to notes
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToNotes(userId, (fetchedNotes) => {
      setNotes(fetchedNotes);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Debounced Auto-save Effect
  useEffect(() => {
    const hasUnsavedChanges = 
      title !== lastSavedValues.current.title || 
      content !== lastSavedValues.current.content;

    if (!hasUnsavedChanges) {
      return;
    }

    if (!title.trim() && !content.trim()) {
      return;
    }

    setSavingStatus('saving');

    const timer = setTimeout(async () => {
      try {
        if (isEditing) {
          // Auto-save active edit note
          await updateNote(isEditing, title.trim(), content.trim());
          lastSavedValues.current = { title, content };
          setSavingStatus('saved');
        } else if (showAddForm) {
          // Auto-save active draft note
          if (draftId) {
            await updateNote(draftId, title.trim(), content.trim());
          } else {
            const newId = await createNote(userId, title.trim(), content.trim());
            setDraftId(newId);
          }
          lastSavedValues.current = { title, content };
          setSavingStatus('saved');
        }
      } catch (err) {
        console.error("Auto-save failed in Firestore:", err);
        setSavingStatus('error');
      }
    }, 1200); // 1.2 second typing debounce

    return () => clearTimeout(timer);
  }, [title, content, isEditing, showAddForm, draftId, userId]);

  const handleStartEdit = (note: PersonalNote) => {
    setIsEditing(note.id);
    setShowAddForm(false);
    setTitle(note.title);
    setContent(note.content);
    lastSavedValues.current = { title: note.title, content: note.content };
    setSavingStatus('idle');
  };

  const handleCloseEdit = () => {
    setIsEditing(null);
    setTitle('');
    setContent('');
    setSavingStatus('idle');
  };

  const handleCloseAddForm = () => {
    setShowAddForm(false);
    setDraftId(null);
    setTitle('');
    setContent('');
    setSavingStatus('idle');
  };

  const handleDeleteNote = async (note: PersonalNote) => {
    const confirmed = window.confirm(`Are you sure you want to delete note "${note.title || 'Untitled note'}"?`);
    if (!confirmed) return;

    try {
      if (draftId === note.id) {
        setDraftId(null);
      }
      await deleteNote(note.id);
    } catch (err) {
      console.error('Error deleting note from Firestore:', err);
    }
  };

  return (
    <div id="notes-tab-container" className="space-y-6">
      {/* Auto-save status feedback banner */}
      {(showAddForm || isEditing) && (
        <div className="flex justify-end pr-2">
          {savingStatus === 'saving' && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Saving changes to Firestore...
            </span>
          )}
          {savingStatus === 'saved' && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All changes auto-saved
            </span>
          )}
          {savingStatus === 'error' && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
              <CloudLightning className="w-3.5 h-3.5" />
              Disconnected. Retrying sync...
            </span>
          )}
        </div>
      )}

      {/* Add Note Button / Form Header */}
      {!showAddForm ? (
        <div className="flex justify-center">
          <button
            onClick={() => {
              setShowAddForm(true);
              setIsEditing(null);
              setDraftId(null);
              setTitle('');
              setContent('');
              lastSavedValues.current = { title: '', content: '' };
              setSavingStatus('idle');
            }}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow-xs flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Auto-Saving Note
          </button>
        </div>
      ) : (
        <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm max-w-xl mx-auto space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <h4 className="font-extrabold text-gray-800 text-sm">New Personal Note</h4>
            <button
              type="button"
              onClick={handleCloseAddForm}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Close Note"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Note Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-150 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
          />

          <textarea
            placeholder="Type anything here... changes sync to the cloud automatically as you type!"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full px-3 py-1.5 border border-gray-150 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed resize-none"
          />

          <div className="flex justify-between items-center pt-2">
            <span className="text-[10px] text-gray-400 italic">
              * Autosave is active
            </span>
            <button
              type="button"
              onClick={handleCloseAddForm}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}

      {/* Grid List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
          <p className="text-xs text-gray-500">Syncing with Cloud Firestore...</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-250 rounded-2xl py-16 text-center max-w-xl mx-auto">
          <FileText className="w-10 h-10 text-gray-350 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-gray-900 mb-1">Your Notebook is Empty</h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
            Write down code fragments, summaries, or thoughts. Everything secures to Firebase Firestore and feeds the AI Co-Pilot memory instantly!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {notes.map((note) => {
            const isNoteEditing = isEditing === note.id;
            const bgClass = NOTE_BG_CLASSES[getNoteColorIndex(note.id)];

            return (
              <div
                key={note.id}
                className={`p-4 rounded-xl border flex flex-col justify-between shadow-xs hover:shadow-md transition-all group ${bgClass}`}
              >
                {isNoteEditing ? (
                  <div className="space-y-2.5 w-full">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-white/80 px-2.5 py-1.5 rounded-lg text-xs font-bold focus:outline-none border border-transparent focus:border-gray-200"
                    />
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={4}
                      className="w-full bg-white/80 p-2.5 rounded-lg text-xs focus:outline-none border border-transparent focus:border-gray-200 resize-none leading-relaxed"
                    />
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[10px] text-gray-400 italic">Autosaving...</span>
                      <button
                        onClick={handleCloseEdit}
                        className="px-3 py-1 bg-black/80 hover:bg-black text-white text-[10px] font-bold rounded-md"
                      >
                        Finish Editing
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5 flex-1">
                      {note.title && <h4 className="font-bold text-sm sm:text-base tracking-tight leading-snug">{note.title}</h4>}
                      <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                        {note.content}
                      </p>
                    </div>

                    <div className="border-t border-black/5 pt-2.5 mt-4 flex items-center justify-between">
                      <span className="text-[10px] text-black/40 font-semibold font-mono">
                        {new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onAttachToChat(note)}
                          title="Ask Co-Pilot about this note"
                          className="p-1 hover:bg-black/5 text-black/60 hover:text-blue-700 rounded transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleStartEdit(note)}
                          title="Edit note"
                          className="p-1 hover:bg-black/5 text-black/60 hover:text-black rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note)}
                          title="Delete note"
                          className="p-1 hover:bg-black/5 text-black/60 hover:text-red-700 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
