import React, { useState, useEffect } from 'react';
import { TaskItem } from '../types';
import { CheckSquare, Square, Plus, Trash2, RefreshCw, MessageSquare, AlertCircle } from 'lucide-react';

interface TasksTabProps {
  accessToken: string;
  onAttachToChat: (task: TaskItem) => void;
}

export default function TasksTab({ accessToken, onAttachToChat }: TasksTabProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = 'https://tasks.googleapis.com/v1/lists/@default/tasks?maxResults=30';
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`Tasks API responded with status ${response.status}`);
      }

      const data = await response.json();
      setTasks(data.items || []);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      setError(err.message || 'Failed to fetch Tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [accessToken]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setAddingTask(true);
    try {
      const url = 'https://tasks.googleapis.com/v1/lists/@default/tasks';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          status: 'needsAction'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to add task: ${response.statusText}`);
      }

      setNewTaskTitle('');
      fetchTasks();
    } catch (err: any) {
      console.error('Error adding task:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTaskStatus = async (task: TaskItem) => {
    const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    
    // Explicit user confirmation for changing state
    const confirmed = window.confirm(`Mark task "${task.title}" as ${newStatus === 'completed' ? 'completed' : 'not completed'}?`);
    if (!confirmed) return;

    try {
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

      const url = `https://tasks.googleapis.com/v1/lists/@default/tasks/${task.id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: task.id,
          status: newStatus
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update task status: ${response.statusText}`);
      }
    } catch (err: any) {
      console.error('Error toggling task:', err);
      alert(`Error toggling task: ${err.message}`);
      // Revert status
      fetchTasks();
    }
  };

  const handleDeleteTask = async (task: TaskItem) => {
    const confirmed = window.confirm(`Are you sure you want to delete task "${task.title}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      // Optimistic delete
      setTasks(prev => prev.filter(t => t.id !== task.id));

      const url = `https://tasks.googleapis.com/v1/lists/@default/tasks/${task.id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete task: ${response.statusText}`);
      }
    } catch (err: any) {
      console.error('Error deleting task:', err);
      alert(`Error deleting task: ${err.message}`);
      fetchTasks();
    }
  };

  return (
    <div id="tasks-tab-container" className="space-y-4 max-w-3xl mx-auto">
      {/* Add Task Form */}
      <form onSubmit={handleAddTask} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-2">
        <input
          type="text"
          placeholder="Add a new task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          disabled={addingTask}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={addingTask || !newTaskTitle.trim()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </form>

      {/* Task List Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">My Google Tasks</span>
          <button
            onClick={fetchTasks}
            title="Refresh tasks"
            className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors flex items-center gap-1 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading && tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600"></div>
            <p className="text-xs text-gray-500">Retrieving task items...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">
            <AlertCircle className="w-8 h-8 mx-auto text-red-400 mb-2" />
            <p className="font-medium">Could not load tasks</p>
            <p className="text-xs text-red-500 mt-1">{error}</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <CheckSquare className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm font-medium">All tasks finished!</p>
            <p className="text-xs text-gray-400 mt-0.5">Use the input above to create tasks.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 flex items-center justify-between gap-3 hover:bg-gray-50/30 transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleTaskStatus(task)}
                    className="text-gray-400 hover:text-emerald-600 transition-colors flex-shrink-0"
                  >
                    {task.status === 'completed' ? (
                      <CheckSquare className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <span className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.title}
                    </span>
                    {task.notes && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{task.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onAttachToChat(task)}
                    title="Ask Co-Pilot about this task"
                    className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task)}
                    title="Delete task"
                    className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
