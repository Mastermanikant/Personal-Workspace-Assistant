import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { Send, Sparkles, X, Paperclip, RefreshCw, AlertCircle } from 'lucide-react';

interface ChatPanelProps {
  accessToken: string | null;
  attachedItem: any;
  onClearAttachedItem: () => void;
}

export default function ChatPanel({ accessToken, attachedItem, onClearAttachedItem }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Hello! I am your Workspace Personal Assistant. I have full co-pilot access to your Google Drive, Gmail inbox, Calendar schedule, Tasks checklist, and Firestore notes.\n\nHow can I help you today? You can ask me to search files, draft emails, compile calendars, summarize messages, or organize your Firestore thoughts!",
      timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const SUGGESTIONS = [
    { label: 'Summarize today\'s agenda', query: 'Can you look at my primary calendar and summarize my agenda/schedule for today?' },
    { label: 'Summarize recent emails', query: 'Search my latest Gmail emails and give me a summary of the most important things I need to look at.' },
    { label: 'Find documents on Drive', query: 'Can you search my Google Drive and list my most recently modified spreadsheets or documents?' },
    { label: 'Show task checklist', query: 'Show me my current task list and let me know if there are urgent deadlines.' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string, customReferences?: any) => {
    if (!textToSend.trim() && !customReferences) return;

    let finalPrompt = textToSend;
    const refData = customReferences || attachedItem;
    
    // If we have an attached item reference, inject its details into the query context
    if (refData) {
      let attachmentText = '';
      if (refData.mimeType) {
        // Drive file
        attachmentText = `[Context Attachment - Google Drive File: "${refData.name}" (ID: ${refData.id}, MIME: ${refData.mimeType})]`;
      } else if (refData.subject) {
        // Gmail email
        attachmentText = `[Context Attachment - Gmail Email: "${refData.subject}" from ${refData.from} (ID: ${refData.id}, Snippet: ${refData.snippet})]`;
        if (refData.body) {
          attachmentText += `\nEmail Body Content:\n"""\n${refData.body}\n"""`;
        }
      } else if (refData.summary) {
        // Calendar Event
        attachmentText = `[Context Attachment - Calendar Event: "${refData.summary}" (ID: ${refData.id}, Time: ${refData.start?.dateTime || refData.start?.date})]`;
      } else if (refData.content && refData.userId) {
        // Firestore Note
        attachmentText = `[Context Attachment - Personal Note: "${refData.title || 'Untitled'}"\nContent:\n"""\n${refData.content}\n"""]`;
      } else if (refData.status) {
        // Task
        attachmentText = `[Context Attachment - Google Task: "${refData.title}" (Status: ${refData.status}, Notes: ${refData.notes || 'None'})]`;
      } else if (refData.email && refData.phone) {
        // Contact
        attachmentText = `[Context Attachment - Contact Card: "${refData.name}" (Email: ${refData.email}, Phone: ${refData.phone})]`;
      }

      finalPrompt = `${attachmentText}\n\nUser Question:\n${textToSend}`;
      onClearAttachedItem();
    }

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend, // Keep original simplified text in the UI
      timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      // Build conversation history payload
      // We pass the final formatted prompts to let Gemini know of any attached context
      const payloadMessages = [
        ...messages.map(m => ({ sender: m.sender, text: m.text })),
        { sender: 'user', text: finalPrompt }
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          googleToken: accessToken,
          localTime: new Date().toString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate chat response');
      }

      const data = await response.json();
      const aiResponseText = data.text || "I processed your request, but wasn't able to compile a text summary. Let me know if I can query something else!";

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: aiResponseText,
          timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      console.error('Chat generation error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: 'ai',
          text: `⚠️ **Co-Pilot Engine Error**:\n\n${err.message || 'We ran into a connection glitch. Please check that you are signed in and try sending your request again.'}`,
          timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleSendMessage(inputText);
  };

  const getAttachmentTypeLabel = (item: any) => {
    if (item.mimeType) return 'Drive File';
    if (item.subject) return 'Email';
    if (item.summary) return 'Calendar Event';
    if (item.content && item.userId) return 'Personal Note';
    if (item.status) return 'Task';
    if (item.email && item.phone) return 'Contact';
    return 'Context Attachment';
  };

  const getAttachmentTitle = (item: any) => {
    return item.name || item.subject || item.summary || item.title || 'Untitled';
  };

  return (
    <div id="chat-panel" className="bg-white rounded-2xl shadow-sm border border-gray-150 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/10 rounded-lg">
            <Sparkles className="w-5 h-5 text-yellow-300 fill-yellow-300" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base leading-tight">Gemini Workspace Co-Pilot</h3>
            <p className="text-[10px] text-white/80">Real-time Agentic AI Reasoning</p>
          </div>
        </div>
        {!accessToken && (
          <span className="text-[10px] bg-red-500/20 text-red-100 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold">
            Offline Mode
          </span>
        )}
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 shadow-sm text-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`}
            >
              {msg.sender === 'user' ? (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              ) : (
                <MarkdownRenderer content={msg.text} />
              )}
            </div>
            <span className="text-[9px] text-gray-400 mt-1 px-1">{msg.timestamp}</span>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2.5">
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-none p-4 max-w-[80%]">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <p className="text-xs text-gray-500 italic">Co-Pilot is researching your request...</p>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips (only when inbox empty/user hasn't typed much, or floating) */}
      <div className="p-3 bg-white border-t border-gray-100 space-y-2">
        {messages.length <= 2 && (
          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(s.query)}
                className="px-2.5 py-1.5 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 text-gray-600 hover:text-blue-700 text-[10px] sm:text-xs font-medium rounded-lg transition-all whitespace-nowrap"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Attachment Card Indicator */}
        {attachedItem && (
          <div className="flex items-center justify-between bg-blue-50/70 border border-blue-100 p-2.5 rounded-lg">
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">
                  {getAttachmentTypeLabel(attachedItem)} Attached
                </p>
                <p className="text-xs text-gray-600 truncate font-semibold">
                  {getAttachmentTitle(attachedItem)}
                </p>
              </div>
            </div>
            <button
              onClick={onClearAttachedItem}
              className="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Chat input form */}
        <form onSubmit={handleFormSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={attachedItem ? "Ask a question about this attached item..." : "Message your personal co-pilot..."}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || (!inputText.trim() && !attachedItem)}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
