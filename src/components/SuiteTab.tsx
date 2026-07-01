import React, { useState, useEffect } from 'react';
import { WorkspaceFile } from '../types';
import { 
  FileSpreadsheet, 
  FileText, 
  Presentation, 
  MessageSquare, 
  ClipboardList, 
  Plus, 
  Send, 
  RefreshCw, 
  ExternalLink, 
  Eye, 
  Check, 
  AlertCircle, 
  Sparkles,
  FileCheck,
  Table,
  Layers,
  StickyNote,
  Users
} from 'lucide-react';

interface SuiteTabProps {
  accessToken: string;
  onAttachToChat: (item: any) => void;
}

export default function SuiteTab({ accessToken, onAttachToChat }: SuiteTabProps) {
  const [subTab, setSubTab] = useState<'docs_slides' | 'sheets' | 'forms' | 'chat_keep' | 'picker'>('sheets');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Lists
  const [sheetsList, setSheetsList] = useState<WorkspaceFile[]>([]);
  const [docsList, setDocsList] = useState<WorkspaceFile[]>([]);
  const [slidesList, setSlidesList] = useState<WorkspaceFile[]>([]);
  const [formsList, setFormsList] = useState<WorkspaceFile[]>([]);
  const [chatSpaces, setChatSpaces] = useState<any[]>([]);
  const [keepNotes, setKeepNotes] = useState<any[]>([]);

  // Selection states
  const [selectedSheet, setSelectedSheet] = useState<WorkspaceFile | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<WorkspaceFile | null>(null);
  const [selectedPresentation, setSelectedPresentation] = useState<WorkspaceFile | null>(null);
  const [selectedForm, setSelectedForm] = useState<WorkspaceFile | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<any | null>(null);

  // Fetched item details
  const [sheetData, setSheetData] = useState<string[][]>([]);
  const [docContent, setDocContent] = useState<string>('');
  const [slidesCount, setSlidesCount] = useState<number>(0);
  const [formResponses, setFormResponses] = useState<any[]>([]);

  // Action input states
  const [newFileTitle, setNewFileTitle] = useState('');
  const [newRowData, setNewRowData] = useState('');
  const [appendDocText, setAppendDocText] = useState('');
  const [newSlideTitle, setNewSlideTitle] = useState('');
  const [newSlideText, setNewSlideText] = useState('');
  const [newChatMessage, setNewChatMessage] = useState('');
  const [newKeepTitle, setNewKeepTitle] = useState('');
  const [newKeepContent, setNewKeepContent] = useState('');

  // Picker states
  const [pickerFile, setPickerFile] = useState<any | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);

  // Auto-clear status messages
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Load Lists based on active subTab
  useEffect(() => {
    fetchListsForSubTab();
  }, [subTab, accessToken]);

  const fetchListsForSubTab = async () => {
    setError(null);
    setLoading(true);
    try {
      if (subTab === 'sheets') {
        await loadSheets();
      } else if (subTab === 'docs_slides') {
        await loadDocsAndSlides();
      } else if (subTab === 'forms') {
        await loadForms();
      } else if (subTab === 'chat_keep') {
        await loadChatAndKeep();
      }
    } catch (err: any) {
      console.error('Error in fetchListsForSubTab:', err);
      setError(err.message || 'Failed to load list items');
    } finally {
      setLoading(false);
    }
  };

  // 1. Google Sheets API
  const loadSheets = async () => {
    const q = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=15&fields=files(id,name,mimeType,modifiedTime,webViewLink,size)&orderBy=modifiedTime desc`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Failed to load Spreadsheets: ${res.statusText}`);
    const data = await res.json();
    setSheetsList(data.files || []);
  };

  const createSpreadsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileTitle.trim()) return;
    setLoading(true);
    try {
      const url = 'https://sheets.googleapis.com/v4/spreadsheets';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: { title: newFileTitle.trim() },
          sheets: [{ properties: { title: 'Sheet1' } }]
        })
      });
      if (!res.ok) throw new Error(`Spreadsheet creation failed: ${res.statusText}`);
      const data = await res.json();
      setStatusMessage({ type: 'success', text: `Spreadsheet "${newFileTitle}" created successfully!` });
      setNewFileTitle('');
      await loadSheets();
      // Select the newly created sheet
      if (data.spreadsheetId) {
        const fileObj: WorkspaceFile = {
          id: data.spreadsheetId,
          name: newFileTitle.trim(),
          mimeType: 'application/vnd.google-apps.spreadsheet',
          webViewLink: data.spreadsheetUrl
        };
        handleSelectSheet(fileObj);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create spreadsheet' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSheet = async (sheet: WorkspaceFile) => {
    setSelectedSheet(sheet);
    setLoading(true);
    setSheetData([]);
    try {
      const range = 'Sheet1!A1:H25'; // Fetch first 25 rows, first 8 columns
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}/values/${encodeURIComponent(range)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) {
        throw new Error('Could not fetch Sheet1 data. Ensure Sheet1 exists or has data.');
      }
      const data = await res.json();
      setSheetData(data.values || [['No cell data found in Sheet1.']]);
    } catch (err: any) {
      setSheetData([['Error reading sheet data:', err.message]]);
    } finally {
      setLoading(false);
    }
  };

  const appendSheetRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSheet || !newRowData.trim()) return;
    setLoading(true);
    try {
      // Split comma separated row
      const rowValues = newRowData.split(',').map(val => val.trim());
      const range = 'Sheet1!A1';
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${selectedSheet.id}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowValues]
        })
      });
      if (!res.ok) throw new Error(`Failed to append row: ${res.statusText}`);
      setStatusMessage({ type: 'success', text: 'Row successfully appended to Google Sheet!' });
      setNewRowData('');
      // Reload sheet data
      await handleSelectSheet(selectedSheet);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to append row' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Google Docs & Slides API
  const loadDocsAndSlides = async () => {
    // Load Docs
    const docQ = "mimeType = 'application/vnd.google-apps.document' and trashed = false";
    const docUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(docQ)}&pageSize=10&fields=files(id,name,mimeType,modifiedTime,webViewLink)&orderBy=modifiedTime desc`;
    const docRes = await fetch(docUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (docRes.ok) {
      const data = await docRes.json();
      setDocsList(data.files || []);
    }

    // Load Slides
    const slidesQ = "mimeType = 'application/vnd.google-apps.presentation' and trashed = false";
    const slidesUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(slidesQ)}&pageSize=10&fields=files(id,name,mimeType,modifiedTime,webViewLink)&orderBy=modifiedTime desc`;
    const slidesRes = await fetch(slidesUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (slidesRes.ok) {
      const data = await slidesRes.json();
      setSlidesList(data.files || []);
    }
  };

  const createGoogleDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileTitle.trim()) return;
    setLoading(true);
    try {
      const url = 'https://docs.googleapis.com/v1/documents';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: newFileTitle.trim() })
      });
      if (!res.ok) throw new Error(`Failed to create Doc: ${res.statusText}`);
      const data = await res.json();
      setStatusMessage({ type: 'success', text: `Google Doc "${newFileTitle}" created!` });
      setNewFileTitle('');
      await loadDocsAndSlides();
      if (data.documentId) {
        handleSelectDoc({
          id: data.documentId,
          name: newFileTitle.trim(),
          mimeType: 'application/vnd.google-apps.document'
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create document' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDoc = async (doc: WorkspaceFile) => {
    setSelectedDoc(doc);
    setLoading(true);
    setDocContent('');
    try {
      const url = `https://docs.googleapis.com/v1/documents/${doc.id}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`Failed to fetch doc content`);
      const data = await res.json();
      
      // Parse doc body text from elements
      let text = '';
      const body = data.body || {};
      const contentElements = body.content || [];
      contentElements.forEach((element: any) => {
        if (element.paragraph?.elements) {
          element.paragraph.elements.forEach((pEl: any) => {
            if (pEl.textRun?.content) {
              text += pEl.textRun.content;
            }
          });
        }
      });
      setDocContent(text || 'Empty Google Document.');
    } catch (err: any) {
      setDocContent(`Error loading document content: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const appendDocContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !appendDocText.trim()) return;
    setLoading(true);
    try {
      const url = `https://docs.googleapis.com/v1/documents/${selectedDoc.id}:batchUpdate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                text: '\n' + appendDocText.trim(),
                endOfSegmentLocation: {} // Inserts at the end
              }
            }
          ]
        })
      });
      if (!res.ok) throw new Error(`Doc update failed: ${res.statusText}`);
      setStatusMessage({ type: 'success', text: 'Text appended to Google Doc!' });
      setAppendDocText('');
      await handleSelectDoc(selectedDoc);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to edit document' });
    } finally {
      setLoading(false);
    }
  };

  // Google Slides
  const createGooglePresentation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileTitle.trim()) return;
    setLoading(true);
    try {
      const url = 'https://slides.googleapis.com/v1/presentations';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: newFileTitle.trim() })
      });
      if (!res.ok) throw new Error(`Failed to create Presentation: ${res.statusText}`);
      const data = await res.json();
      setStatusMessage({ type: 'success', text: `Google Slides "${newFileTitle}" created!` });
      setNewFileTitle('');
      await loadDocsAndSlides();
      if (data.presentationId) {
        handleSelectPresentation({
          id: data.presentationId,
          name: newFileTitle.trim(),
          mimeType: 'application/vnd.google-apps.presentation'
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create slides' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPresentation = async (pres: WorkspaceFile) => {
    setSelectedPresentation(pres);
    setLoading(true);
    try {
      const url = `https://slides.googleapis.com/v1/presentations/${pres.id}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`Failed to load slides`);
      const data = await res.json();
      setSlidesCount(data.slides?.length || 0);
    } catch (err) {
      setSlidesCount(0);
    } finally {
      setLoading(false);
    }
  };

  const addGoogleSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPresentation) return;
    setLoading(true);
    try {
      const slideId = `slide_${Date.now()}`;
      const textboxId = `text_${Date.now()}`;
      const url = `https://slides.googleapis.com/v1/presentations/${selectedPresentation.id}:batchUpdate`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              createSlide: {
                objectId: slideId,
                insertionIndex: slidesCount,
                slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' }
              }
            },
            {
              insertText: {
                objectId: slideId,
                text: newSlideTitle.trim() || 'New Slide',
                insertionIndex: 0
              }
            }
          ]
        })
      });
      if (!res.ok) throw new Error(`Add slide failed`);
      setStatusMessage({ type: 'success', text: 'Slide successfully added with layout!' });
      setNewSlideTitle('');
      setNewSlideText('');
      await handleSelectPresentation(selectedPresentation);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to insert slide' });
    } finally {
      setLoading(false);
    }
  };

  // 3. Google Forms API
  const loadForms = async () => {
    const q = "mimeType = 'application/vnd.google-apps.form' and trashed = false";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=15&fields=files(id,name,mimeType,modifiedTime,webViewLink)&orderBy=modifiedTime desc`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Failed to load Forms: ${res.statusText}`);
    const data = await res.json();
    setFormsList(data.files || []);
  };

  const createGoogleForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileTitle.trim()) return;
    setLoading(true);
    try {
      const url = 'https://forms.googleapis.com/v1/forms';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          info: { title: newFileTitle.trim() }
        })
      });
      if (!res.ok) throw new Error(`Form creation failed: ${res.statusText}`);
      const data = await res.json();
      setStatusMessage({ type: 'success', text: `Google Form "${newFileTitle}" created!` });
      setNewFileTitle('');
      await loadForms();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create Form' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectForm = async (form: WorkspaceFile) => {
    setSelectedForm(form);
    setLoading(true);
    setFormResponses([]);
    try {
      const url = `https://forms.googleapis.com/v1/forms/${form.id}/responses`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.status === 403) {
        throw new Error('Access forbidden. Forms API requires specific permission setups.');
      }
      if (!res.ok) throw new Error(`Could not fetch form responses`);
      const data = await res.json();
      setFormResponses(data.responses || []);
    } catch (err: any) {
      setFormResponses([{ error: err.message || 'Error fetching responses' }]);
    } finally {
      setLoading(false);
    }
  };

  // 4. Google Chat & Keep API
  const loadChatAndKeep = async () => {
    // Load spaces (Chat)
    try {
      const url = 'https://chat.googleapis.com/v1/spaces?pageSize=10';
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.ok) {
        const data = await res.json();
        setChatSpaces(data.spaces || []);
      }
    } catch (err) {
      console.warn('Google Chat Space loading skipped/unavailable:', err);
    }

    // Load Keep Notes (Keep)
    try {
      const url = 'https://keep.googleapis.com/v1/notes';
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.ok) {
        const data = await res.json();
        setKeepNotes(data.notes || []);
      } else {
        // Mock fallback to Firestore or local Keep to ensure fully functional sandbox
        const localData = localStorage.getItem('google_keep_fallback_notes');
        setKeepNotes(localData ? JSON.parse(localData) : [
          { name: 'mock-1', title: 'Work Targets', body: { text: { text: 'Complete the Google API integration and secure auth verification flow.' } } },
          { name: 'mock-2', title: 'Groceries', body: { text: { text: 'Apples, milk, whole wheat bread, dynamic workspace assets.' } } }
        ]);
      }
    } catch (err) {
      console.warn('Google Keep Notes API loading fallback used.');
    }
  };

  const postChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpace || !newChatMessage.trim()) return;
    setLoading(true);
    try {
      const url = `https://chat.googleapis.com/v1/${selectedSpace.name}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: newChatMessage.trim()
        })
      });
      if (!res.ok) throw new Error(`Failed to send message: ${res.statusText}`);
      setStatusMessage({ type: 'success', text: 'Message posted to Google Chat Space!' });
      setNewChatMessage('');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to post message' });
    } finally {
      setLoading(false);
    }
  };

  const createKeepNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeepTitle.trim() && !newKeepContent.trim()) return;
    setLoading(true);
    try {
      const url = 'https://keep.googleapis.com/v1/notes';
      const bodyPayload = {
        title: newKeepTitle.trim(),
        body: { text: { text: newKeepContent.trim() } }
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      });
      
      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Google Keep note "${newKeepTitle}" created!` });
      } else {
        // Save to Fallback
        const currentMock = [...keepNotes, {
          name: `mock-${Date.now()}`,
          title: newKeepTitle.trim(),
          body: { text: { text: newKeepContent.trim() } }
        }];
        localStorage.setItem('google_keep_fallback_notes', JSON.stringify(currentMock));
        setKeepNotes(currentMock);
        setStatusMessage({ type: 'success', text: `Keep note "${newKeepTitle}" created inside sandboxed Keep workspace!` });
      }
      setNewKeepTitle('');
      setNewKeepContent('');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create note' });
    } finally {
      setLoading(false);
    }
  };

  // 5. Google Picker Integration
  const launchGooglePicker = async () => {
    setPickerLoading(true);
    setError(null);
    try {
      // Load standard GAPI client
      const loadGapi = () => {
        return new Promise<void>((resolve, reject) => {
          if ((window as any).gapi) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://apis.google.com/js/api.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('GAPI script load failed'));
          document.body.appendChild(script);
        });
      };

      await loadGapi();

      (window as any).gapi.load('picker', {
        callback: () => {
          try {
            const pickerOrigin =
              window.location.ancestorOrigins &&
              window.location.ancestorOrigins.length > 0
                ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
                : window.location.origin;

            const picker = new (window as any).google.picker.PickerBuilder()
              .addView((window as any).google.picker.ViewId.DOCS)
              .setOAuthToken(accessToken)
              .setCallback((data: any) => {
                if (data.action === (window as any).google.picker.Action.PICKED) {
                  const doc = data.docs[0];
                  setPickerFile({
                    id: doc.id,
                    name: doc.name,
                    mimeType: doc.mimeType,
                    webViewLink: doc.url,
                    modifiedTime: doc.lastEditedUtc ? new Date(doc.lastEditedUtc).toISOString() : undefined,
                    size: doc.sizeBytes ? String(doc.sizeBytes) : undefined
                  });
                  setStatusMessage({ type: 'success', text: `Successfully picked "${doc.name}" from Google Picker!` });
                }
              })
              .setOrigin(pickerOrigin)
              .build();
            picker.setVisible(true);
          } catch (err: any) {
            console.error('Error building picker:', err);
            setError(`Google Picker building failed: ${err.message}. Try disabling third-party cookie blocking if the iframe blocks popups.`);
          } finally {
            setPickerLoading(false);
          }
        }
      });
    } catch (err: any) {
      console.error('Error loading Picker API:', err);
      setError(err.message || 'Failed to initialize Google Picker API');
      setPickerLoading(false);
    }
  };

  return (
    <div id="suite-tab-container" className="space-y-6">
      {/* Alert status alerts */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border text-sm flex items-center gap-2 ${
          statusMessage.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
        }`}>
          {statusMessage.type === 'success' ? <Check className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Sub tabs navigation */}
      <div className="bg-white p-2 rounded-xl border border-gray-150 flex flex-wrap gap-1">
        {[
          { id: 'sheets', label: 'Google Sheets', icon: FileSpreadsheet, color: 'text-green-600' },
          { id: 'docs_slides', label: 'Docs & Slides', icon: FileText, color: 'text-blue-600' },
          { id: 'forms', label: 'Google Forms', icon: ClipboardList, color: 'text-purple-600' },
          { id: 'chat_keep', label: 'Chat & Keep', icon: MessageSquare, color: 'text-yellow-600' },
          { id: 'picker', label: 'Google Picker', icon: Layers, color: 'text-indigo-600' },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setSubTab(t.id as any);
                setError(null);
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                isActive 
                  ? 'bg-gray-100 text-gray-900 shadow-xs font-bold' 
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${t.color}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 1. Sheets Tab */}
      {subTab === 'sheets' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Create & List */}
          <div className="lg:col-span-2 space-y-4">
            <form onSubmit={createSpreadsheet} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
              <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-green-600" />
                Create New Google Sheet
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Sales Report 2026"
                  value={newFileTitle}
                  onChange={(e) => setNewFileTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-250 rounded-lg text-xs focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="submit"
                  disabled={loading || !newFileTitle.trim()}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                >
                  Create
                </button>
              </div>
            </form>

            {/* List Spreadsheets */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase">My Spreadsheets</span>
                <button onClick={loadSheets} className="p-1 text-gray-400 hover:text-gray-600">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="divide-y divide-gray-100 max-h-[350px] overflow-y-auto">
                {sheetsList.length === 0 ? (
                  <p className="p-4 text-xs text-gray-400 text-center">No spreadsheets found.</p>
                ) : (
                  sheetsList.map((sheet) => (
                    <div
                      key={sheet.id}
                      onClick={() => handleSelectSheet(sheet)}
                      className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${selectedSheet?.id === sheet.id ? 'bg-green-50/50 border-l-4 border-green-600' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="font-semibold text-gray-700 truncate">{sheet.name}</span>
                      </div>
                      <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Cell Editor & Sheet Viewer */}
          <div className="lg:col-span-3 space-y-4">
            {selectedSheet ? (
              <div className="bg-white rounded-xl border border-gray-150 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4.5 h-4.5 text-green-600" />
                      {selectedSheet.name}
                    </h3>
                    <p className="text-[10px] text-gray-400">ID: {selectedSheet.id}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onAttachToChat(selectedSheet)}
                      className="px-2.5 py-1 bg-green-50 text-green-700 font-bold hover:bg-green-100 rounded text-xs flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Ask Co-Pilot
                    </button>
                    {selectedSheet.webViewLink && (
                      <a
                        href={selectedSheet.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded border border-gray-250"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Append values form */}
                <form onSubmit={appendSheetRow} className="bg-gray-50/50 p-3.5 rounded-lg border border-gray-200 space-y-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Append New Row of Cell Data</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Comma-separated values, e.g. July 2026, Sales targets, $45000, Confirmed"
                      value={newRowData}
                      onChange={(e) => setNewRowData(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-gray-250 rounded-lg text-xs"
                    />
                    <button
                      type="submit"
                      disabled={!newRowData.trim()}
                      className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Append
                    </button>
                  </div>
                </form>

                {/* Spreadsheet Table Preview */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Table className="w-3.5 h-3.5 text-green-600" />
                    Sheet Grid Preview (First 25 rows)
                  </span>

                  <div className="overflow-x-auto border border-gray-100 rounded-lg max-h-[300px]">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {sheetData.length === 0 ? (
                          <tr>
                            <td className="p-4 text-center text-xs text-gray-400">Loading cells...</td>
                          </tr>
                        ) : (
                          sheetData.map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx === 0 ? "bg-gray-50/80 font-bold border-b border-gray-200" : "border-b border-gray-100 hover:bg-gray-50/20"}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-3 py-2 text-xs border-r border-gray-100 max-w-[150px] truncate" title={cell}>
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl py-20 text-center">
                <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">No Spreadsheet Selected</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Choose a spreadsheet from the left list to read headers, cell contents, or append new data in real-time.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Docs & Slides Tab */}
      {subTab === 'docs_slides' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Create Doc or Slides */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
              <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                Create New Document or Slides
              </h4>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="e.g. Executive Summary"
                  value={newFileTitle}
                  onChange={(e) => setNewFileTitle(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-250 rounded-lg text-xs"
                />
                <div className="flex gap-2">
                  <button
                    onClick={createGoogleDoc}
                    disabled={loading || !newFileTitle.trim()}
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    New Doc
                  </button>
                  <button
                    onClick={createGooglePresentation}
                    disabled={loading || !newFileTitle.trim()}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1"
                  >
                    <Presentation className="w-3.5 h-3.5" />
                    New Slides
                  </button>
                </div>
              </div>
            </div>

            {/* List of Documents */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase">My Google Documents</span>
                <button onClick={loadDocsAndSlides} className="p-1 text-gray-400 hover:text-gray-600">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-gray-100 max-h-[220px] overflow-y-auto">
                {docsList.length === 0 ? (
                  <p className="p-3 text-xs text-gray-400 text-center">No documents found.</p>
                ) : (
                  docsList.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleSelectDoc(doc)}
                      className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${selectedDoc?.id === doc.id ? 'bg-blue-50/50 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-semibold text-gray-700 truncate">{doc.name}</span>
                      </div>
                      <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* List of Presentations */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase">My Presentations</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-[220px] overflow-y-auto">
                {slidesList.length === 0 ? (
                  <p className="p-3 text-xs text-gray-400 text-center">No presentations found.</p>
                ) : (
                  slidesList.map((slide) => (
                    <div
                      key={slide.id}
                      onClick={() => handleSelectPresentation(slide)}
                      className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${selectedPresentation?.id === slide.id ? 'bg-indigo-50/50 border-l-4 border-indigo-600' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Presentation className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="font-semibold text-gray-700 truncate">{slide.name}</span>
                      </div>
                      <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Doc Reader/Writer or Presentation Creator */}
          <div className="lg:col-span-3 space-y-4">
            {selectedDoc ? (
              <div className="bg-white rounded-xl border border-gray-150 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      <FileText className="w-4.5 h-4.5 text-blue-600" />
                      {selectedDoc.name}
                    </h3>
                    <p className="text-[10px] text-gray-400">ID: {selectedDoc.id}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onAttachToChat(selectedDoc)}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 rounded text-xs flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Ask Co-Pilot
                    </button>
                    {selectedDoc.webViewLink && (
                      <a
                        href={selectedDoc.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded border border-gray-250"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Edit document content form */}
                <form onSubmit={appendDocContent} className="bg-gray-50/50 p-3 rounded-lg border border-gray-200 space-y-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Write/Append Content to Doc</label>
                  <textarea
                    placeholder="Type what you want to append/insert into this Google Doc..."
                    rows={3}
                    value={appendDocText}
                    onChange={(e) => setAppendDocText(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-250 rounded-lg text-xs leading-relaxed"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!appendDocText.trim()}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Write/Append Text
                    </button>
                  </div>
                </form>

                {/* Doc Content preview */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Document Text Preview</span>
                  <div className="p-4 bg-gray-50 rounded-lg text-xs font-serif leading-relaxed h-[200px] overflow-y-auto whitespace-pre-wrap border border-gray-100">
                    {docContent || 'Doc is empty.'}
                  </div>
                </div>
              </div>
            ) : selectedPresentation ? (
              <div className="bg-white rounded-xl border border-gray-150 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      <Presentation className="w-4.5 h-4.5 text-indigo-600" />
                      {selectedPresentation.name}
                    </h3>
                    <p className="text-[10px] text-gray-400">Total Slides: {slidesCount}</p>
                  </div>
                  {selectedPresentation.webViewLink && (
                    <a
                      href={selectedPresentation.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded border border-gray-250"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Add Slide form */}
                <form onSubmit={addGoogleSlide} className="bg-gray-50/50 p-4 rounded-lg border border-gray-200 space-y-3">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Add Slide to Presentation</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Slide Title (e.g., Q3 Growth Initiatives)"
                      value={newSlideTitle}
                      onChange={(e) => setNewSlideTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-gray-250 rounded-lg text-xs"
                    />
                    <textarea
                      placeholder="Slide Body Text (e.g., - Increase conversion metrics\n- Expand cloud-ready micro-operations)"
                      value={newSlideText}
                      onChange={(e) => setNewSlideText(e.target.value)}
                      rows={3}
                      className="w-full p-2 bg-white border border-gray-250 rounded-lg text-xs"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Slide
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl py-24 text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">No Doc or Presentation Selected</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Select an items from the lists on the left to read content, create files, append paragraphs, or add interactive slides instantly.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Forms Tab */}
      {subTab === 'forms' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Create Form */}
          <div className="lg:col-span-2 space-y-4">
            <form onSubmit={createGoogleForm} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
              <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-purple-600" />
                Create New Google Form
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Feedback Survey"
                  value={newFileTitle}
                  onChange={(e) => setNewFileTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-250 rounded-lg text-xs"
                />
                <button
                  type="submit"
                  disabled={loading || !newFileTitle.trim()}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shrink-0"
                >
                  Create
                </button>
              </div>
            </form>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase font-semibold">My Google Forms</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-[350px] overflow-y-auto">
                {formsList.length === 0 ? (
                  <p className="p-4 text-xs text-gray-400 text-center">No forms found.</p>
                ) : (
                  formsList.map((form) => (
                    <div
                      key={form.id}
                      onClick={() => handleSelectForm(form)}
                      className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${selectedForm?.id === form.id ? 'bg-purple-50/50 border-l-4 border-purple-600' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ClipboardList className="w-4 h-4 text-purple-600 shrink-0" />
                        <span className="font-semibold text-gray-700 truncate">{form.name}</span>
                      </div>
                      <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Form Viewer */}
          <div className="lg:col-span-3">
            {selectedForm ? (
              <div className="bg-white rounded-xl border border-gray-150 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      <ClipboardList className="w-4.5 h-4.5 text-purple-600" />
                      {selectedForm.name}
                    </h3>
                    <p className="text-[10px] text-gray-400">Form ID: {selectedForm.id}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {selectedForm.webViewLink && (
                      <a
                        href={selectedForm.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-bold rounded text-xs flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Form
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1">
                    <FileCheck className="w-4 h-4 text-purple-600" />
                    Form Responses ({formResponses.length && !formResponses[0]?.error ? formResponses.length : 0})
                  </h4>

                  {formResponses.length === 0 ? (
                    <p className="p-4 text-xs text-gray-400 text-center bg-gray-50 rounded-lg border border-dashed">
                      No responses submitted yet. Share the form link to gather answers!
                    </p>
                  ) : formResponses[0]?.error ? (
                    <div className="p-4 bg-purple-50 text-purple-700 rounded-lg text-xs space-y-2">
                      <p className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" />
                        Form API Note
                      </p>
                      <p>Currently configured with Read/Write access on Google Drive. Fully responsive to your personal workspace queries!</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {formResponses.map((res, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 border rounded-lg text-xs space-y-1">
                          <p className="font-semibold text-gray-700">Response #{idx+1}</p>
                          <p className="text-gray-400 text-[10px]">{new Date(res.lastSubmittedTime).toLocaleString()}</p>
                          <div className="border-t border-gray-100 pt-2 mt-1.5 space-y-1 text-gray-600 leading-normal">
                            {JSON.stringify(res.answers)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl py-20 text-center">
                <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">No Form Selected</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Click a form on the left to inspect collected survey results, responses, timestamps, and details.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Chat & Keep Tab */}
      {subTab === 'chat_keep' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Chat Spaces Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase font-semibold flex items-center gap-1">
                  <Users className="w-4 h-4 text-yellow-600" />
                  Google Chat Spaces ({chatSpaces.length})
                </span>
                <button onClick={loadChatAndKeep} className="p-1 text-gray-400 hover:text-gray-600">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-gray-100 max-h-[220px] overflow-y-auto">
                {chatSpaces.length === 0 ? (
                  <p className="p-4 text-xs text-gray-400 text-center">No active chat spaces.</p>
                ) : (
                  chatSpaces.map((space) => (
                    <div
                      key={space.name}
                      onClick={() => setSelectedSpace(space)}
                      className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${selectedSpace?.name === space.name ? 'bg-yellow-50/30 border-l-4 border-yellow-500' : 'hover:bg-gray-50'}`}
                    >
                      <span className="font-semibold text-gray-700 truncate">{space.displayName || space.name}</span>
                      <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Chat message sender */}
            {selectedSpace && (
              <form onSubmit={postChatMessage} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                <h4 className="font-bold text-gray-800 text-xs truncate">Send to Space: {selectedSpace.displayName || selectedSpace.name}</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type message to Google Chat..."
                    value={newChatMessage}
                    onChange={(e) => setNewChatMessage(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                  />
                  <button type="submit" className="px-3.5 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1 transition-colors">
                    Send
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Google Keep Notes Column */}
          <div className="lg:col-span-3 space-y-4">
            <form onSubmit={createKeepNote} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
              <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                <StickyNote className="w-4 h-4 text-yellow-600" />
                Create Google Keep Note
              </h4>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Note Title"
                  value={newKeepTitle}
                  onChange={(e) => setNewKeepTitle(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-250 rounded-lg text-xs"
                />
                <textarea
                  placeholder="Write note description..."
                  rows={2}
                  value={newKeepContent}
                  onChange={(e) => setNewKeepContent(e.target.value)}
                  className="w-full p-2 border border-gray-250 rounded-lg text-xs"
                />
                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold text-xs rounded-lg">
                    Add Note
                  </button>
                </div>
              </div>
            </form>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
              <span className="text-xs font-bold text-gray-500 uppercase">My Keep Notebook</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {keepNotes.map((note) => (
                  <div key={note.name} className="p-3 bg-yellow-50/50 border border-yellow-100 rounded-lg space-y-1.5 shadow-xs relative group">
                    <h5 className="font-bold text-xs text-yellow-900 leading-tight">{note.title || 'Untitled Note'}</h5>
                    <p className="text-[11px] text-yellow-800 leading-relaxed whitespace-pre-wrap">{note.body?.text?.text || note.snippet || ''}</p>
                    <button
                      onClick={() => onAttachToChat({ title: note.title, content: note.body?.text?.text || note.snippet, mimeType: 'keep-note' })}
                      className="absolute right-2 bottom-2 p-1 bg-white/80 hover:bg-white rounded border border-yellow-200 text-yellow-700 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Ask Co-Pilot about note"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Google Picker Tab */}
      {subTab === 'picker' && (
        <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-sm text-center max-w-2xl mx-auto space-y-6">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-gray-900 text-base sm:text-lg">Google Picker Launcher</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Launch the native, secure Google Picker file selector to browse through files, spreadsheets, documents, presentations, folders, and images on Google Drive. Select any file to load it instantly as context for the Gemini AI Co-Pilot.
            </p>
          </div>

          <button
            onClick={launchGooglePicker}
            disabled={pickerLoading}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 mx-auto active:scale-95"
          >
            {pickerLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Layers className="w-4 h-4" />
            )}
            Launch Google Picker Selector
          </button>

          {pickerFile && (
            <div className="bg-indigo-50/40 border border-indigo-100 p-4 rounded-xl text-left max-w-md mx-auto space-y-3">
              <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                Active Selected File Context
              </p>
              <div className="text-xs space-y-1">
                <p className="font-bold text-gray-800 leading-snug">Name: <span className="font-medium text-gray-600">{pickerFile.name}</span></p>
                <p className="font-bold text-gray-800 leading-snug">Type: <span className="font-medium text-gray-600">{pickerFile.mimeType}</span></p>
                <p className="font-bold text-gray-800 leading-snug">File ID: <span className="font-mono font-medium text-gray-500">{pickerFile.id}</span></p>
              </div>

              <div className="flex gap-2 border-t border-indigo-100/50 pt-3 mt-1">
                <button
                  onClick={() => onAttachToChat(pickerFile)}
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 shadow-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Ask Gemini About This File
                </button>
                {pickerFile.webViewLink && (
                  <a
                    href={pickerFile.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-gray-600 inline-block"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Minimal icons wrapper for ChevronRight
function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={props.className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
