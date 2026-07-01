export interface WorkspaceFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject?: string;
  from?: string;
  date?: string;
  body?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  htmlLink?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  updated?: string;
}

export interface ContactItem {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
}

export interface PersonalNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  isLoading?: boolean;
  references?: {
    type: 'file' | 'email' | 'event' | 'task' | 'contact' | 'note';
    title: string;
    id: string;
    link?: string;
  }[];
}
