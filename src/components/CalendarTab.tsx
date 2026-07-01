import React, { useState, useEffect } from 'react';
import { CalendarEvent } from '../types';
import { Calendar, Clock, MapPin, MessageSquare, RefreshCw } from 'lucide-react';

interface CalendarTabProps {
  accessToken: string;
  onAttachToChat: (event: CalendarEvent) => void;
}

export default function CalendarTab({ accessToken, onAttachToChat }: CalendarTabProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const timeMin = new Date().toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&maxResults=15`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`Calendar API responded with status ${response.status}`);
      }

      const data = await response.json();
      setEvents(data.items || []);
    } catch (err: any) {
      console.error('Error fetching calendar events:', err);
      setError(err.message || 'Failed to fetch Calendar events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [accessToken]);

  const formatEventTime = (event: CalendarEvent) => {
    if (!event.start) return '—';
    const startStr = event.start.dateTime || event.start.date;
    const endStr = event.end?.dateTime || event.end?.date;
    if (!startStr) return '—';

    const start = new Date(startStr);
    
    // Check if full-day event
    if (event.start.date) {
      return `${start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} (All Day)`;
    }

    const end = endStr ? new Date(endStr) : null;
    const dateFormatted = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const startTimeFormatted = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const endTimeFormatted = end ? end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';

    return `${dateFormatted}, ${startTimeFormatted} ${endTimeFormatted ? `- ${endTimeFormatted}` : ''}`;
  };

  return (
    <div id="calendar-tab-container" className="space-y-4">
      {/* Header Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-gray-800 text-sm sm:text-base">Upcoming Schedule</h3>
        </div>
        <button
          onClick={fetchEvents}
          title="Refresh Schedule"
          className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Events Timeline */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-sm text-gray-500">Retrieving your schedule...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-center py-10">
          <p className="font-medium text-sm mb-1">Could not load schedule</p>
          <p className="text-xs text-red-500 mb-3">{error}</p>
          <button
            onClick={fetchEvents}
            className="px-4 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl py-16 text-center">
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">No upcoming events</h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            You don't have any events scheduled on your primary Google Calendar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:border-indigo-100 transition-all group"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 text-sm sm:text-base truncate group-hover:text-indigo-600 transition-colors">
                  {event.summary}
                </h4>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    {formatEventTime(event)}
                  </span>
                  {event.location && (
                    <span className="flex items-center gap-1 max-w-[250px] truncate" title={event.location}>
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {event.location}
                    </span>
                  )}
                </div>
                {event.description && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-1 italic max-w-2xl">
                    {event.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end w-full md:w-auto gap-2 border-t md:border-t-0 border-gray-50 pt-2.5 md:pt-0">
                <button
                  onClick={() => onAttachToChat(event)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
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
