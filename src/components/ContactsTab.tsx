import React, { useState, useEffect } from 'react';
import { ContactItem } from '../types';
import { Users, Search, RefreshCw, Mail, Phone, MessageSquare, User } from 'lucide-react';

interface ContactsTabProps {
  accessToken: string;
  onAttachToChat: (contact: ContactItem) => void;
}

export default function ContactsTab({ accessToken, onAttachToChat }: ContactsTabProps) {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = 'https://people.googleapis.com/v1/people/me/connections?pageSize=50&personFields=names,emailAddresses,phoneNumbers,photos';
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`People API responded with status ${response.status}`);
      }

      const data = await response.json();
      const connections = data.connections || [];

      const formatted: ContactItem[] = connections.map((c: any) => {
        const names = c.names || [];
        const displayName = names[0]?.displayName || 'Unnamed Contact';
        
        const emails = c.emailAddresses || [];
        const email = emails[0]?.value || '';

        const phones = c.phoneNumbers || [];
        const phone = phones[0]?.value || '';

        const photos = c.photos || [];
        const photoUrl = photos[0]?.url || '';

        return {
          id: c.resourceName,
          name: displayName,
          email,
          phone,
          photoUrl
        };
      });

      setContacts(formatted);
    } catch (err: any) {
      console.error('Error fetching contacts:', err);
      setError(err.message || 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [accessToken]);

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="contacts-tab-container" className="space-y-4">
      {/* Search Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search contacts by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-gray-400" />
        </div>
        <button
          onClick={fetchContacts}
          title="Refresh contacts"
          className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
          <p className="text-sm text-gray-500">Loading contacts...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-center py-10">
          <p className="font-medium text-sm mb-1">Could not load contacts</p>
          <p className="text-xs text-red-500 mb-3">{error}</p>
          <button
            onClick={fetchContacts}
            className="px-4 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl py-16 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">No contacts found</h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            {searchQuery ? "We couldn't find any contacts matching your search query." : "No contacts were retrieved from your Google Account."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:border-amber-150 transition-all hover:shadow-md group"
            >
              <div className="flex items-start gap-3">
                {/* Contact Photo / Avatar */}
                {contact.photoUrl && !contact.photoUrl.includes('placeholder') ? (
                  <img
                    src={contact.photoUrl}
                    alt={contact.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border border-gray-100"
                  />
                ) : (
                  <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center font-bold text-sm">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <h4 className="font-bold text-gray-900 text-sm truncate">{contact.name}</h4>
                  <div className="space-y-1 mt-1.5 text-xs text-gray-500">
                    {contact.email && (
                      <span className="flex items-center gap-1.5 truncate" title={contact.email}>
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        {contact.email}
                      </span>
                    )}
                    {contact.phone && (
                      <span className="flex items-center gap-1.5 truncate">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        {contact.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-50 pt-2.5 mt-3 flex items-center justify-end gap-1">
                <button
                  onClick={() => onAttachToChat(contact)}
                  title="Discuss or ask about this contact"
                  className="px-2.5 py-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors flex items-center gap-1 font-semibold"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Ask Co-Pilot
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
