import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ORG = 'solis-center';

export async function GET() {
  try {
    const snap = await getDocs(collection(db, `orgs/${ORG}/teams`));
    const teams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ teams });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const id = data.name.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    await setDoc(doc(db, `orgs/${ORG}/teams/${id}`), {
      name: data.name,
      color: data.color || '#6B7280',
      icon: data.icon || '📁',
      description: data.description || '',
      status: 'active',
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
