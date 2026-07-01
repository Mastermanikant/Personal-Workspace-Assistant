import React, { useState, useEffect } from 'react';
import { GmailMessage } from '../types';
import { Mail, Search, MessageSquare, ExternalLink, RefreshCw, ChevronRight, User, Calendar, CornerUpLeft } from 'lucide-react';

interface GmailTabProps {
  accessToken: string;
  onAttachToChat: (message: GmailMessage) => void;
}

export default function GmailTab({ accessToken, onAttachToChat }: GmailTabProps) {
  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<GmailMessage | null>(null);
  const [emailDetailsLoading, setEmailDetailsLoading] = useState(false);

  const fetchEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10';
      if (searchQuery) {
        url += `&q=${encodeURIComponent(searchQuery)}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`Gmail API responded with status ${response.status}`);
      }

      const data = await response.json();
      const messagesList = data.messages || [];

      // Fetch details for each message in parallel
      const details = await Promise.all(
        messagesList.map(async (msg: { id: string }) => {
          try {
            const detailRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (!detailRes.ok) return null;
            const detailData = await detailRes.json();
            
            const headers = detailData.payload?.headers || [];
            const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
            const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
            const date = headers.find((h: any) => h.name === 'Date')?.value || '';

            return {
              id: detailData.id,
              threadId: detailData.threadId,
              snippet: detailData.snippet || '',
              subject,
              from,
              date,
            };
          } catch (err) {
            console.error(`Error loading message details for ${msg.id}:`, err);
            return null;
          }
        })
      );

      setEmails(details.filter((d): d is GmailMessage => d !== null));
    } catch (err: any) {
      console.error('Error loading Gmail messages:', err);
      setError(err.message || 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [accessToken]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEmails();
  };

  const handleSelectEmail = async (email: GmailMessage) => {
    setEmailDetailsLoading(true);
    setSelectedEmail(email);
    try {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (detailRes.ok) {
        const fullMsg = await detailRes.json();
        
        // Find text/plain body
        let bodyText = '';
        if (fullMsg.payload?.body?.data) {
          bodyText = Buffer.from(fullMsg.payload.body.data, 'base64').toString('utf-8');
        } else if (fullMsg.payload?.parts) {
          const findTextPart = (parts: any[]): string => {
            for (const p of parts) {
              if (p.mimeType === "text/plain" && p.body?.data) {
                return Buffer.from(p.body.data, 'base64').toString('utf-8');
              }
              if (p.parts) {
                const sub = findTextPart(p.parts);
                if (sub) return sub;
              }
            }
            return '';
          };
          bodyText = findTextPart(fullMsg.payload.parts);
        }

        // Strip HTML if it's there
        if (bodyText && bodyText.includes('<html') || bodyText.includes('<div')) {
          bodyText = bodyText.replace(/<[^>]*>/g, ' ');
        }

        setSelectedEmail({
          ...email,
          body: bodyText || 'No plain text content available.',
        });
      }
    } catch (err) {
      console.error('Error fetching full email details:', err);
    } finally {
      setEmailDetailsLoading(false);
    }
  };

  const cleanFromName = (fromStr?: string) => {
    if (!fromStr) return 'Unknown';
    return fromStr.replace(/<.*>/, '').trim();
  };

  return (
    <div id="gmail-tab-container" className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Email List Column */}
      <div className={`${selectedEmail ? 'lg:col-span-3' : 'lg:col-span-5'} space-y-4 transition-all duration-300`}>
        {/* Search Header */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <input
              type="text"
              placeholder="Search emails (e.g., 'from:boss subject:report')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-gray-400" />
            {searchQuery && (
              <button
                type="submit"
                className="absolute right-2 top-1.5 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
              >
                Search
              </button>
            )}
          </form>

          <button
            onClick={fetchEmails}
            title="Refresh inbox"
            className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-500">Loading your inbox...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-center py-10">
            <p className="font-medium text-sm mb-1">Could not load emails</p>
            <p className="text-xs text-red-500 mb-3">{error}</p>
            <button
              onClick={fetchEmails}
              className="px-4 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : emails.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl py-16 text-center">
            <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">Your inbox is clean</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              {searchQuery ? "No emails match your query." : "We couldn't retrieve any emails from your Gmail account."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {emails.map((email) => (
              <div
                key={email.id}
                onClick={() => handleSelectEmail(email)}
                className={`p-4 flex items-start gap-3 cursor-pointer transition-colors ${selectedEmail?.id === email.id ? 'bg-blue-50/40 border-l-4 border-blue-600' : 'hover:bg-gray-50/50'}`}
              >
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg hidden sm:block mt-1 flex-shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-gray-900 truncate text-xs sm:text-sm">
                      {cleanFromName(email.from)}
                    </span>
                    <span className="text-gray-400 text-[10px] whitespace-nowrap">
                      {email.date ? new Date(email.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-800 text-xs sm:text-sm truncate mb-0.5">
                    {email.subject}
                  </h4>
                  <p className="text-gray-500 text-xs truncate">
                    {email.snippet}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 self-center" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email Reader Column */}
      {selectedEmail && (
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col h-[600px] sticky top-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <h3 className="font-bold text-gray-900 text-sm line-clamp-1 flex-1 pr-4">
              {selectedEmail.subject}
            </h3>
            <button
              onClick={() => setSelectedEmail(null)}
              className="text-xs font-semibold text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          </div>

          {/* Metadata */}
          <div className="space-y-2 text-xs border-b border-gray-50 pb-4 mb-4">
            <div className="flex items-center text-gray-600 gap-1.5">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium text-gray-800">From:</span>
              <span className="truncate">{selectedEmail.from}</span>
            </div>
            <div className="flex items-center text-gray-600 gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium text-gray-800">Date:</span>
              <span>{selectedEmail.date ? new Date(selectedEmail.date).toLocaleString() : '—'}</span>
            </div>
          </div>

          {/* Body content */}
          <div className="flex-1 overflow-y-auto text-sm text-gray-700 font-sans leading-relaxed whitespace-pre-line pr-1">
            {emailDetailsLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <p className="text-xs text-gray-400">Loading body content...</p>
              </div>
            ) : (
              selectedEmail.body || selectedEmail.snippet
            )}
          </div>

          {/* Quick Actions Footer */}
          <div className="border-t border-gray-100 pt-3 mt-4 flex items-center gap-2">
            <button
              onClick={() => onAttachToChat(selectedEmail)}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Discuss with Co-Pilot
            </button>
            <button
              onClick={() => onAttachToChat({ ...selectedEmail, snippet: `Reply required for: "${selectedEmail.subject}". Please draft a response.` })}
              title="Draft a response reply"
              className="p-2 border border-gray-200 hover:border-blue-500 hover:text-blue-600 rounded-lg text-gray-500 transition-all"
            >
              <CornerUpLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
