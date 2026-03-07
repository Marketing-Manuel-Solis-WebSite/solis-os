import {
  collection, doc, addDoc, deleteDoc, getDocs, query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const ORG = 'solis-center';

export type EntityType = 'task' | 'doc' | 'goal';
export type RelationType = 'related_to' | 'references' | 'contributes_to' | 'parent_of' | 'child_of' | 'blocks' | 'blocked_by';

export interface EntityRelation {
  id: string;
  orgId: string;
  sourceType: EntityType;
  sourceId: string;
  sourceName: string;
  targetType: EntityType;
  targetId: string;
  targetName: string;
  relationType: RelationType;
  createdBy: string;
  createdByName: string;
  createdAt: any;
}

export const RELATION_TYPES: { id: RelationType; labelEs: string; labelEn: string }[] = [
  { id: 'related_to', labelEs: 'Relacionado con', labelEn: 'Related to' },
  { id: 'references', labelEs: 'Referencia a', labelEn: 'References' },
  { id: 'contributes_to', labelEs: 'Contribuye a', labelEn: 'Contributes to' },
  { id: 'blocks', labelEs: 'Bloquea', labelEn: 'Blocks' },
  { id: 'blocked_by', labelEs: 'Bloqueado por', labelEn: 'Blocked by' },
  { id: 'parent_of', labelEs: 'Padre de', labelEn: 'Parent of' },
  { id: 'child_of', labelEs: 'Hijo de', labelEn: 'Child of' },
];

export async function createRelation(data: {
  sourceType: EntityType;
  sourceId: string;
  sourceName: string;
  targetType: EntityType;
  targetId: string;
  targetName: string;
  relationType: RelationType;
  createdBy: string;
  createdByName: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'relations'), {
    orgId: ORG,
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteRelation(id: string): Promise<void> {
  await deleteDoc(doc(db, `relations/${id}`));
}

// Get all relations where entity is source or target
export async function getRelationsForEntity(entityId: string): Promise<EntityRelation[]> {
  const [asSource, asTarget] = await Promise.all([
    getDocs(query(
      collection(db, 'relations'),
      where('orgId', '==', ORG),
      where('sourceId', '==', entityId),
    )),
    getDocs(query(
      collection(db, 'relations'),
      where('orgId', '==', ORG),
      where('targetId', '==', entityId),
    )),
  ]);

  const seen = new Set<string>();
  const results: EntityRelation[] = [];

  for (const snap of [asSource, asTarget]) {
    for (const d of snap.docs) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        results.push({ id: d.id, ...d.data() } as EntityRelation);
      }
    }
  }

  return results.sort((a, b) => {
    const ta = a.createdAt?.seconds || 0;
    const tb = b.createdAt?.seconds || 0;
    return tb - ta;
  });
}
