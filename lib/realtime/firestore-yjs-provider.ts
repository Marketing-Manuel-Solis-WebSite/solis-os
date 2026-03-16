// ============================================================
// FirestoreYjsProvider — syncs a Yjs document via Firestore.
//
// Each doc's Yjs state is stored as a series of incremental
// updates in:  orgs/{orgId}/yjsDocs/{docId}/updates/{updateId}
//
// A compacted snapshot lives at:
//   orgs/{orgId}/yjsDocs/{docId}  (field: snapshot)
//
// Flow:
//  1. On connect → load snapshot + any updates after it
//  2. Subscribe to new updates via onSnapshot
//  3. Local Yjs changes → write to Firestore updates subcollection
//  4. Periodically compact updates into a single snapshot
// ============================================================

import * as Y from 'yjs';
import {
  collection, doc, onSnapshot, addDoc, getDocs, getDoc,
  setDoc, query, orderBy, where, writeBatch,
  serverTimestamp, Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Awareness } from 'y-protocols/awareness';
import { ORG_ID as ORG } from '@/lib/org';


const COMPACT_THRESHOLD = 50; // compact after N updates

// ─── Paths ───────────────────────────────────────────────
function yjsDocPath(docId: string) {
  return `orgs/${ORG}/yjsDocs/${docId}`;
}
function updatesCol(docId: string) {
  return `orgs/${ORG}/yjsDocs/${docId}/updates`;
}
function awarenessDocPath(docId: string) {
  return `orgs/${ORG}/yjsDocs/${docId}/awareness`;
}

export interface FirestoreProviderOptions {
  /** Firestore document ID */
  docId: string;
  /** Yjs document instance */
  ydoc: Y.Doc;
  /** Awareness instance (for cursor tracking) */
  awareness?: Awareness;
  /** Current user info for awareness */
  user?: { id: string; name: string; color: string };
}

export class FirestoreYjsProvider {
  readonly docId: string;
  readonly ydoc: Y.Doc;
  readonly awareness: Awareness | null;

  private _unsubs: Unsubscribe[] = [];
  private _synced = false;
  private _destroying = false;
  private _lastSnapshotSeq = 0;
  private _pendingUpdates = 0;
  private _userId: string;
  private _awarenessInterval: ReturnType<typeof setInterval> | null = null;

  constructor(opts: FirestoreProviderOptions) {
    this.docId = opts.docId;
    this.ydoc = opts.ydoc;
    this.awareness = opts.awareness ?? null;
    this._userId = opts.user?.id ?? '';

    this._init(opts.user);
  }

  get synced() { return this._synced; }

  // ─── Initialization ──────────────────────────────────
  private async _init(user?: { id: string; name: string; color: string }) {
    try {
      // 1. Load existing snapshot
      const snapDoc = await getDoc(doc(db, yjsDocPath(this.docId)));
      if (snapDoc.exists()) {
        const data = snapDoc.data();
        if (data.snapshot) {
          const bytes = this._toUint8Array(data.snapshot);
          Y.applyUpdate(this.ydoc, bytes);
        }
        this._lastSnapshotSeq = data.seq ?? 0;
      }

      // 2. Load updates after snapshot
      const updatesRef = collection(db, updatesCol(this.docId));
      const q = query(
        updatesRef,
        where('seq', '>', this._lastSnapshotSeq),
        orderBy('seq', 'asc'),
      );

      const existingUpdates = await getDocs(q);
      existingUpdates.forEach((d) => {
        const bytes = this._toUint8Array(d.data().data);
        Y.applyUpdate(this.ydoc, bytes);
        this._pendingUpdates++;
      });

      this._synced = true;

      // 3. Subscribe to new updates (real-time)
      const latestSeq = existingUpdates.empty
        ? this._lastSnapshotSeq
        : existingUpdates.docs[existingUpdates.docs.length - 1].data().seq;

      const liveQ = query(
        updatesRef,
        where('seq', '>', latestSeq),
        orderBy('seq', 'asc'),
      );

      let initialLoad = true;
      const unsub = onSnapshot(liveQ, (snap) => {
        if (initialLoad) { initialLoad = false; return; } // skip first snapshot (already loaded)
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const d = change.doc.data();
            // Skip our own writes (already applied locally)
            if (d.origin === this._userId) return;
            const bytes = this._toUint8Array(d.data);
            Y.applyUpdate(this.ydoc, bytes);
            this._pendingUpdates++;
          }
        });

        // Auto-compact if too many updates
        if (this._pendingUpdates >= COMPACT_THRESHOLD) {
          this._compact();
        }
      });
      this._unsubs.push(unsub);

      // 4. Listen to local Yjs changes → write to Firestore
      this.ydoc.on('update', this._onLocalUpdate);

      // 5. Set up awareness sync
      if (this.awareness && user) {
        this.awareness.setLocalStateField('user', {
          id: user.id,
          name: user.name,
          color: user.color,
        });
        this._setupAwareness();
      }
    } catch (err) {
      console.error('[FirestoreYjsProvider] init error:', err);
    }
  }

  // ─── Local update handler ────────────────────────────
  private _onLocalUpdate = (update: Uint8Array, origin: any) => {
    // Skip remote updates (they came from Firestore)
    if (origin === 'remote' || this._destroying) return;

    this._writeUpdate(update).catch((err) => {
      console.error('[FirestoreYjsProvider] write error:', err);
    });
  };

  private _nextSeq = 0;

  private async _writeUpdate(update: Uint8Array) {
    const seq = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const updatesRef = collection(db, updatesCol(this.docId));
    await addDoc(updatesRef, {
      data: Array.from(update),
      seq,
      origin: this._userId,
      createdAt: serverTimestamp(),
    });
    this._pendingUpdates++;
  }

  // ─── Compaction ──────────────────────────────────────
  private async _compact() {
    if (this._destroying) return;

    try {
      const fullState = Y.encodeStateAsUpdate(this.ydoc);
      const seq = Date.now() * 1000 + Math.floor(Math.random() * 1000);

      // Write new snapshot
      await setDoc(doc(db, yjsDocPath(this.docId)), {
        snapshot: Array.from(fullState),
        seq,
        compactedAt: serverTimestamp(),
      }, { merge: true });

      // Delete old updates (those before the new seq)
      const updatesRef = collection(db, updatesCol(this.docId));
      const oldUpdates = await getDocs(
        query(updatesRef, where('seq', '<=', seq)),
      );

      // Batch delete (max 500 per batch)
      const batches: ReturnType<typeof writeBatch>[] = [];
      let currentBatch = writeBatch(db);
      let count = 0;

      oldUpdates.forEach((d) => {
        currentBatch.delete(d.ref);
        count++;
        if (count % 450 === 0) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
        }
      });
      batches.push(currentBatch);

      await Promise.all(batches.map((b) => b.commit()));

      this._lastSnapshotSeq = seq;
      this._pendingUpdates = 0;
    } catch (err) {
      console.error('[FirestoreYjsProvider] compact error:', err);
    }
  }

  // ─── Awareness (cursor/selection sync) ───────────────
  private _setupAwareness() {
    if (!this.awareness) return;

    // Write local awareness state periodically
    const writeAwareness = async () => {
      if (this._destroying || !this.awareness) return;
      const local = this.awareness.getLocalState();
      if (!local) return;

      const awarenessRef = doc(db, awarenessDocPath(this.docId), this._userId);
      await setDoc(awarenessRef, {
        state: JSON.stringify(local),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    };

    // Write immediately + every 3 seconds
    writeAwareness();
    this._awarenessInterval = setInterval(writeAwareness, 3000);

    // Listen for awareness changes from others
    const awarenessCol = collection(db, awarenessDocPath(this.docId));
    const unsub = onSnapshot(awarenessCol, (snap) => {
      if (!this.awareness || this._destroying) return;
      snap.docChanges().forEach((change) => {
        const uid = change.doc.id;
        if (uid === this._userId) return; // skip self

        if (change.type === 'removed') {
          // Find clientId for this user and remove
          const states = this.awareness!.getStates();
          states.forEach((state, clientId) => {
            if (state.user?.id === uid) {
              this.awareness!.setLocalStateField('__remove_' + clientId, null);
            }
          });
          return;
        }

        const data = change.doc.data();
        if (!data.state) return;

        try {
          const state = JSON.parse(data.state);
          // Check staleness (10 second threshold)
          const updatedAt = data.updatedAt?.seconds ?? 0;
          const now = Date.now() / 1000;
          if (now - updatedAt > 10) return;

          // Apply remote awareness state
          // We encode it as a remote client
          const states = this.awareness!.getStates();
          let existingClientId: number | null = null;
          states.forEach((s, cid) => {
            if (s.user?.id === uid) existingClientId = cid;
          });

          if (existingClientId !== null) {
            this.awareness!.states.set(existingClientId, state);
          } else {
            // Create a synthetic client ID from user ID hash
            const clientId = this._hashCode(uid);
            this.awareness!.states.set(clientId, state);
          }
          this.awareness!.emit('change', [{ added: [], updated: [], removed: [] }, 'remote']);
        } catch { /* ignore parse errors */ }
      });
    });
    this._unsubs.push(unsub);
  }

  private _hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    // Ensure positive and won't collide with local client
    return Math.abs(hash) + 1000000;
  }

  // ─── Helpers ─────────────────────────────────────────
  private _toUint8Array(data: any): Uint8Array {
    if (data instanceof Uint8Array) return data;
    if (Array.isArray(data)) return new Uint8Array(data);
    if (data?.type === 'Buffer' && Array.isArray(data.data)) return new Uint8Array(data.data);
    return new Uint8Array(0);
  }

  // ─── Cleanup ─────────────────────────────────────────
  destroy() {
    this._destroying = true;

    // Remove local update listener
    this.ydoc.off('update', this._onLocalUpdate);

    // Unsubscribe Firestore listeners
    this._unsubs.forEach((u) => u());
    this._unsubs = [];

    // Stop awareness interval
    if (this._awarenessInterval) {
      clearInterval(this._awarenessInterval);
      this._awarenessInterval = null;
    }

    // Clean up awareness doc
    if (this.awareness && this._userId) {
      const { deleteDoc } = require('firebase/firestore');
      deleteDoc(doc(db, awarenessDocPath(this.docId), this._userId)).catch(() => {});
    }
  }
}
