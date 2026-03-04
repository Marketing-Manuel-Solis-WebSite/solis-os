import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ORG = 'solis-center';
const RESOURCE_COLLECTIONS = ['tasks', 'goals', 'docs', 'channels', 'forms', 'time-entries', 'whiteboards', 'automations'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const snap = await getDoc(doc(db, `orgs/${ORG}/teams/${id}`));
    if (!snap.exists()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ team: { id: snap.id, ...snap.data() } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await req.json();
    await updateDoc(doc(db, `orgs/${ORG}/teams/${id}`), { ...data, updatedAt: serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'safe'; // 'safe' | 'purge'
    const reassignTo = searchParams.get('reassignTo') || '';

    if (mode === 'safe' && reassignTo) {
      // Reassign all resources to target team, then delete
      for (const col of RESOURCE_COLLECTIONS) {
        const q_ = query(collection(db, col), where('orgId', '==', ORG), where('teamId', '==', id));
        const snap = await getDocs(q_);
        for (const d of snap.docs) {
          await updateDoc(doc(db, `${col}/${d.id}`), { teamId: reassignTo, updatedAt: serverTimestamp() });
        }
      }
      // Reassign members
      const membersSnap = await getDocs(collection(db, `orgs/${ORG}/members`));
      const targetSnap = await getDoc(doc(db, `orgs/${ORG}/teams/${reassignTo}`));
      const targetName = targetSnap.exists() ? targetSnap.data().name : '';
      for (const d of membersSnap.docs) {
        const data = d.data();
        if (data.teamId === id) {
          const newIds = (data.teamIds || []).filter((t: string) => t !== id);
          if (!newIds.includes(reassignTo)) newIds.push(reassignTo);
          await updateDoc(doc(db, `orgs/${ORG}/members/${d.id}`), { teamId: reassignTo, teamIds: newIds, department: targetName, updatedAt: serverTimestamp() });
        }
      }
    } else if (mode === 'purge') {
      // Delete all resources, then delete team
      for (const col of RESOURCE_COLLECTIONS) {
        const q_ = query(collection(db, col), where('orgId', '==', ORG), where('teamId', '==', id));
        const snap = await getDocs(q_);
        for (const d of snap.docs) {
          await deleteDoc(doc(db, `${col}/${d.id}`));
        }
      }
      // Unassign members
      const membersSnap = await getDocs(collection(db, `orgs/${ORG}/members`));
      for (const d of membersSnap.docs) {
        const data = d.data();
        if (data.teamId === id) {
          await updateDoc(doc(db, `orgs/${ORG}/members/${d.id}`), { teamId: '', teamIds: (data.teamIds || []).filter((t: string) => t !== id), department: '', updatedAt: serverTimestamp() });
        }
      }
    }

    await deleteDoc(doc(db, `orgs/${ORG}/teams/${id}`));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
