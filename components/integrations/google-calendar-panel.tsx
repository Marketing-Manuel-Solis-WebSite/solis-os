'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { Calendar, Plus, Edit3, Trash2, MapPin, Clock, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export default function GoogleCalendarPanel() {
  const { t } = useI18n();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // ---- Compute time range ----
  const getTimeRange = useCallback(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() + weekOffset * 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
    };
  }, [weekOffset]);

  // ---- Fetch events ----
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { timeMin, timeMax } = getTimeRange();
      const params = new URLSearchParams({ timeMin, timeMax, maxResults: '50' });
      const res = await fetch(`/api/integrations/calendar/events?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, [getTimeRange]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ---- Create event ----
  const handleCreate = async (form: { summary: string; startDateTime: string; endDateTime: string; description?: string; location?: string }) => {
    try {
      const res = await fetch('/api/integrations/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to create');
      setShowCreateForm(false);
      fetchEvents();
    } catch (err: any) {
      setError(err?.message);
    }
  };

  // ---- Update event ----
  const handleUpdate = async (eventId: string, updates: Record<string, string>) => {
    try {
      const res = await fetch('/api/integrations/calendar/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, ...updates }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setEditingEvent(null);
      fetchEvents();
    } catch (err: any) {
      setError(err?.message);
    }
  };

  // ---- Delete event ----
  const handleDelete = async (eventId: string) => {
    try {
      const res = await fetch('/api/integrations/calendar/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      fetchEvents();
    } catch (err: any) {
      setError(err?.message);
    }
  };

  // ---- Format helpers ----
  const formatTime = (dt: string) => {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dt: string) => {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const weekLabel = () => {
    const { timeMin, timeMax } = getTimeRange();
    const start = new Date(timeMin);
    const end = new Date(timeMax);
    end.setDate(end.getDate() - 1);
    return `${formatDate(start.toISOString())} - ${formatDate(end.toISOString())}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-400" />
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Google Calendar</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[13px] text-[var(--text-secondary)] min-w-[180px] text-center">
            {weekLabel()}
          </span>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-[13px] bg-[var(--accent)] text-white rounded-md hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-[13px] text-red-400 bg-red-500/10 px-3 py-2 rounded-md">{error}</div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <EventForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Edit Form */}
      {editingEvent && (
        <EventForm
          initial={editingEvent}
          onSubmit={(form) => handleUpdate(editingEvent.id, form as any)}
          onCancel={() => setEditingEvent(null)}
        />
      )}

      {/* Event List */}
      {loading ? (
        <div className="text-center py-8 text-[var(--text-muted)] text-[13px]">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)] text-[13px]">
          No events this week
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <div
              key={event.id}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-[var(--bg-tertiary)]/60 hover:bg-[var(--bg-tertiary)] transition group"
            >
              <div className="w-1 h-10 rounded bg-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-[var(--text-primary)] truncate">
                  {event.summary || '(No title)'}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[12px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(event.start)} {formatTime(event.start)} - {formatTime(event.end)}
                  </span>
                  {event.location && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => setEditingEvent(event)}
                  className="p-1 rounded hover:bg-[var(--bg-base)] text-[var(--text-muted)]"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(event.id)}
                  className="p-1 rounded hover:bg-[var(--bg-base)] text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Inline Event Form ----

function EventForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: CalendarEvent;
  onSubmit: (form: { summary: string; startDateTime: string; endDateTime: string; description?: string; location?: string }) => void;
  onCancel: () => void;
}) {
  const [summary, setSummary] = useState(initial?.summary || '');
  const [startDateTime, setStartDateTime] = useState(initial?.start || '');
  const [endDateTime, setEndDateTime] = useState(initial?.end || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [location, setLocation] = useState(initial?.location || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim() || !startDateTime || !endDateTime) return;
    onSubmit({ summary: summary.trim(), startDateTime, endDateTime, description, location });
  };

  const inputClass = 'w-full px-3 py-1.5 text-[13px] rounded-md bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]';

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-lg bg-[var(--bg-tertiary)]/80 border border-[var(--border)]">
      <input
        type="text"
        value={summary}
        onChange={e => setSummary(e.target.value)}
        placeholder="Event title"
        className={inputClass}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          type="datetime-local"
          value={startDateTime.replace('Z', '').slice(0, 16)}
          onChange={e => setStartDateTime(new Date(e.target.value).toISOString())}
          className={inputClass}
        />
        <input
          type="datetime-local"
          value={endDateTime.replace('Z', '').slice(0, 16)}
          onChange={e => setEndDateTime(new Date(e.target.value).toISOString())}
          className={inputClass}
        />
      </div>
      <input
        type="text"
        value={location}
        onChange={e => setLocation(e.target.value)}
        placeholder="Location (optional)"
        className={inputClass}
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className={inputClass}
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          Cancel
        </button>
        <button type="submit" className="px-4 py-1.5 text-[13px] bg-[var(--accent)] text-white rounded-md hover:opacity-90">
          {initial ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}
