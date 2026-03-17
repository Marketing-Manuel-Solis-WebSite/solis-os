'use client';

// ================================================================
// Contextual Channels — Auto-created channels linked to Spaces/Lists
// ================================================================
// When a Space or List is created, an associated chat channel can be
// auto-created. The channel inherits the Space/List name and members.

import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './firebase';
import { createChannel } from './db';
import { getCurrentOrgId } from '@/lib/org';

/**
 * Find or create a channel linked to a Space.
 * Returns the channel ID.
 */
export async function ensureSpaceChannel(
  spaceId: string,
  spaceName: string,
  creatorId: string,
): Promise<string> {
  const orgId = getCurrentOrgId();

  // Check if channel already exists for this space
  const q = query(
    collection(db, 'channels'),
    where('orgId', '==', orgId),
    where('linkedEntityType', '==', 'space'),
    where('linkedEntityId', '==', spaceId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].id;

  // Create new channel
  const ref = await createChannel({
    name: `# ${spaceName}`,
    description: `Channel for space: ${spaceName}`,
    type: 'public',
    members: [creatorId],
    teamId: spaceId,
  } as any);

  return ref.id;
}

/**
 * Find or create a channel linked to a List.
 * Returns the channel ID.
 */
export async function ensureListChannel(
  listId: string,
  listName: string,
  spaceId: string,
  creatorId: string,
): Promise<string> {
  const orgId = getCurrentOrgId();

  // Check if channel already exists for this list
  const q = query(
    collection(db, 'channels'),
    where('orgId', '==', orgId),
    where('linkedEntityType', '==', 'list'),
    where('linkedEntityId', '==', listId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].id;

  // Create new channel
  const ref = await createChannel({
    name: `# ${listName}`,
    description: `Channel for list: ${listName}`,
    type: 'public',
    members: [creatorId],
    teamId: spaceId,
  } as any);

  return ref.id;
}

/**
 * Get the channel linked to a specific entity.
 */
export async function getLinkedChannel(
  entityType: 'space' | 'list',
  entityId: string,
): Promise<string | null> {
  const orgId = getCurrentOrgId();
  const q = query(
    collection(db, 'channels'),
    where('orgId', '==', orgId),
    where('linkedEntityType', '==', entityType),
    where('linkedEntityId', '==', entityId),
    limit(1),
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].id;
}
