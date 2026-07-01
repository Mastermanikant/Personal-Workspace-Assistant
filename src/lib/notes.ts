import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { PersonalNote } from '../types';

export const subscribeToNotes = (
  userId: string, 
  onUpdate: (notes: PersonalNote[]) => void
) => {
  const notesRef = collection(db, 'notes');
  const q = query(
    notesRef, 
    where('userId', '==', userId), 
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const notes: PersonalNote[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      notes.push({
        id: doc.id,
        title: data.title || '',
        content: data.content || '',
        createdAt: data.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate()?.toISOString() || new Date().toISOString(),
        userId: data.userId || '',
      });
    });
    onUpdate(notes);
  }, (error) => {
    console.error("Error subscribing to Firestore notes:", error);
  });
};

export const createNote = async (userId: string, title: string, content: string) => {
  const notesRef = collection(db, 'notes');
  const docRef = await addDoc(notesRef, {
    userId,
    title,
    content,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateNote = async (noteId: string, title: string, content: string) => {
  const noteRef = doc(db, 'notes', noteId);
  await updateDoc(noteRef, {
    title,
    content,
    updatedAt: serverTimestamp(),
  });
};

export const deleteNote = async (noteId: string) => {
  const noteRef = doc(db, 'notes', noteId);
  await deleteDoc(noteRef);
};
