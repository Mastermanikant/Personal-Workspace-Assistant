import React, { useState, useEffect } from 'react';
import { WorkspaceFile } from '../types';
import { File, FileText, FileSpreadsheet, Image, HardDrive, Search, ExternalLink, MessageSquare, RefreshCw } from 'lucide-react';

interface DriveTabProps {
  accessToken: string;
  onAttachToChat: (file: WorkspaceFile) => void;
}

export default function DriveTab({ accessToken, onAttachToChat }: DriveTabProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'doc' | 'sheet' | 'pdf' | 'image'>('all');

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = "trashed = false";
      if (searchQuery) {
        q += ` and name contains '${searchQuery.replace(/'/g, "\\'")}'`;
      }
      if (filterType === 'doc') {
        q += " and mimeType = 'application/vnd.google-apps.document'";
      } else if (filterType === 'sheet') {
        q += " and mimeType = 'application/vnd.google-apps.spreadsheet'";
      } else if (filterType === 'pdf') {
        q += " and mimeType = 'application/pdf'";
      } else if (filterType === 'image') {
        q += " and mimeType contains 'image/'";
      }

      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=30&fields=files(id,name,mimeType,modifiedTime,webViewLink,size)&orderBy=modifiedTime desc`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`Drive API responded with status ${response.status}`);
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (err: any) {
      console.error('Error fetching files:', err);
      setError(err.message || 'Failed to fetch Drive files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [filterType, accessToken]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFiles();
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('vnd.google-apps.document') || mimeType.includes('word')) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    if (mimeType.includes('vnd.google-apps.spreadsheet') || mimeType.includes('sheet') || mimeType.includes('excel')) {
      return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    }
    if (mimeType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    if (mimeType.includes('image/')) {
      return <Image className="w-5 h-5 text-purple-500" />;
    }
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const formatSize = (bytesStr?: string) => {
    if (!bytesStr) return '—';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div id="drive-tab-container" className="space-y-4">
      {/* Search & Filter Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <input
            type="text"
            placeholder="Search files in your Google Drive..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >
            All Files
          </button>
          <button
            onClick={() => setFilterType('doc')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === 'doc' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >
            Docs
          </button>
          <button
            onClick={() => setFilterType('sheet')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === 'sheet' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >
            Sheets
          </button>
          <button
            onClick={() => setFilterType('pdf')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === 'pdf' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >
            PDFs
          </button>
          <button
            onClick={() => setFilterType('image')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === 'image' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >
            Images
          </button>
          <button
            onClick={fetchFiles}
            title="Refresh"
            className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Files Grid/List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-500">Loading Drive files...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-center py-10">
          <p className="font-medium text-sm mb-1">Could not load files</p>
          <p className="text-xs text-red-500 mb-3">{error}</p>
          <button
            onClick={fetchFiles}
            className="px-4 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : files.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl py-16 text-center">
          <HardDrive className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">No files found</h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            {searchQuery ? "We couldn't find any files matching your search query." : "No files were retrieved from your Google Drive."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4 hidden md:table-cell">Type</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Last Modified</th>
                  <th className="py-3 px-4 hidden md:table-cell">Size</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3 max-w-xs md:max-w-md">
                        <div className="p-1.5 bg-gray-50 rounded">
                          {getFileIcon(file.mimeType)}
                        </div>
                        <span className="font-medium text-gray-800 truncate" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 text-xs hidden md:table-cell truncate max-w-[120px]">
                      {file.mimeType.split('.').pop()?.split('/').pop() || 'File'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 text-xs hidden sm:table-cell">
                      {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 text-xs hidden md:table-cell">
                      {formatSize(file.size)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => onAttachToChat(file)}
                          title="Ask Co-Pilot about this file"
                          className="p-1.5 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded-lg transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open in Drive"
                            className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-lg transition-colors inline-block"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
