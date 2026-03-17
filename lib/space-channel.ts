// ============================================================
// Space Channel — Auto-creates and manages contextual chat
// channels for each Space. Channels share Space permissions.
// ============================================================

import { collection, query, where, getDocs, addDoc, Timestamp, limit } from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentOrgId } from '@/lib/org';

/**
 * Get or create the default channel for a space.
 * Returns the channelId.
 */
export async function getOrCreateSpaceChannel(
  spaceId: string,
  spaceName: string,
  creatorId: string,
): Promise<string> {
  const orgId = getCurrentOrgId();
  const channelsRef = collection(db, 'orgs', orgId, 'channels');

  // Check if a space channel already exists
  const q = query(channelsRef, where('teamId', '==', spaceId), where('type', '==', 'public'), limit(1));
  const snap = await getDocs(q);

  if (snap.docs.length > 0) {
    return snap.docs[0].id;
  }

  // Create a new space channel
  const channelDoc = await addDoc(channelsRef, {
    name: spaceName.toLowerCase().replace(/\s+/g, '-'),
    description: `Auto-created channel for ${spaceName}`,
    type: 'public',
    teamId: spaceId,
    createdBy: creatorId,
    members: [creatorId],
    admins: [creatorId],
    pinnedMessages: [],
    archived: false,
    icon: '💬',
    lastMessageAt: Timestamp.now(),
    lastMessagePreview: '',
    lastMessageBy: '',
    createdAt: Timestamp.now(),
  });

  return channelDoc.id;
}

/**
 * Ensure all spaces have a default channel.
 * Called during org initialization or as a migration.
 */
export async function ensureAllSpaceChannels(
  spaces: { id: string; name: string }[],
  creatorId: string,
): Promise<{ created: number; existing: number }> {
  let created = 0;
  let existing = 0;

  for (const space of spaces) {
    const orgId = getCurrentOrgId();
    const channelsRef = collection(db, 'orgs', orgId, 'channels');
    const q = query(channelsRef, where('teamId', '==', space.id), where('type', '==', 'public'), limit(1));
    const snap = await getDocs(q);

    if (snap.docs.length > 0) {
      existing++;
    } else {
      await getOrCreateSpaceChannel(space.id, space.name, creatorId);
      created++;
    }
  }

  return { created, existing };
}
