import { collection, doc, setDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ORG_ID as ORG } from '@/lib/org';

export interface Favorite {
  userId: string;
  entityType: 'task' | 'goal' | 'doc' | 'space' | 'list';
  entityId: string;
  entityTitle?: string;
  pinnedAt: any;
}

function favoritesCol(userId: string) {
  return collection(db, 'orgs', ORG, 'members', userId, 'favorites');
}

export async function toggleFavorite(userId: string, fav: Omit<Favorite, 'pinnedAt' | 'userId'>): Promise<boolean> {
  const ref = doc(favoritesCol(userId), `${fav.entityType}_${fav.entityId}`);
  // Toggle: try delete first, if not exists then add
  try {
    const { getDoc: getD } = await import('firebase/firestore');
    const snap = await getD(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
      return false; // removed
    }
  } catch {}
  await setDoc(ref, { ...fav, userId, pinnedAt: serverTimestamp() });
  return true; // added
}

export async function getFavorites(userId: string): Promise<Favorite[]> {
  const q = query(favoritesCol(userId), orderBy('pinnedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data() } as Favorite));
}

export async function isFavorite(userId: string, entityType: string, entityId: string): Promise<boolean> {
  const { getDoc: getD } = await import('firebase/firestore');
  const ref = doc(favoritesCol(userId), `${entityType}_${entityId}`);
  const snap = await getD(ref);
  return snap.exists();
}
