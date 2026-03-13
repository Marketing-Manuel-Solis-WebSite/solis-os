/**
 * Firestore Rules — Hierarchy Security Tests
 *
 * Covers the 5 mandatory scenarios:
 *   1. Block create/update task with listId from another space
 *   2. Block read of spaceSharedViews outside user's space
 *   3. Allow manager+ to create folder/list
 *   4. Block member from creating folder/list
 *   5. Allow member to read structure in their space
 *   6. Block member from updating (rename/move/reorder) folder/list
 *   7. Allow manager+ to update (rename/move/reorder) folder/list
 *   8. Docs cross-space folderId validation
 *   9. Whiteboards cross-space folderId + team isolation
 *  10. Doc/Whiteboard folderId move requires manager+
 *
 * Run:
 *   npx firebase emulators:exec --only firestore "npx vitest run tests/firestore-hierarchy-rules.test.ts"
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

const PROJECT_ID = 'solis-test';
const ORG_ID = 'solis-center';
const SPACE_A = 'space-a';
const SPACE_B = 'space-b';

// Users
const OWNER_UID = 'owner-1';
const MANAGER_UID = 'manager-1';
const MEMBER_A_UID = 'member-a-1'; // belongs to space-a
const MEMBER_B_UID = 'member-b-1'; // belongs to space-b

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed org members
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // Owner (org-wide access)
    await setDoc(doc(db, `orgs/${ORG_ID}/members/${OWNER_UID}`), {
      role: 'owner',
      active: true,
      teamId: SPACE_A,
    });

    // Manager (org-wide via role)
    await setDoc(doc(db, `orgs/${ORG_ID}/members/${MANAGER_UID}`), {
      role: 'manager',
      active: true,
      teamId: SPACE_A,
    });

    // Member in space A
    await setDoc(doc(db, `orgs/${ORG_ID}/members/${MEMBER_A_UID}`), {
      role: 'member',
      active: true,
      teamId: SPACE_A,
    });

    // Member in space B
    await setDoc(doc(db, `orgs/${ORG_ID}/members/${MEMBER_B_UID}`), {
      role: 'member',
      active: true,
      teamId: SPACE_B,
    });

    // Lists: list-a1 belongs to space-a, list-b1 belongs to space-b
    await setDoc(doc(db, 'lists/list-a1'), {
      orgId: ORG_ID,
      spaceId: SPACE_A,
      name: 'List A1',
      position: 0,
    });

    await setDoc(doc(db, 'lists/list-b1'), {
      orgId: ORG_ID,
      spaceId: SPACE_B,
      name: 'List B1',
      position: 0,
    });

    // Folders
    await setDoc(doc(db, 'folders/folder-a1'), {
      orgId: ORG_ID,
      spaceId: SPACE_A,
      name: 'Folder A1',
      position: 0,
    });

    await setDoc(doc(db, 'folders/folder-b1'), {
      orgId: ORG_ID,
      spaceId: SPACE_B,
      name: 'Folder B1',
      position: 0,
    });

    // Existing task in space-a with list-a1
    await setDoc(doc(db, 'tasks/task-a1'), {
      orgId: ORG_ID,
      teamId: SPACE_A,
      listId: 'list-a1',
      title: 'Task in A',
      status: 'todo',
    });

    // Shared views for space A and B
    await setDoc(doc(db, `orgs/${ORG_ID}/spaceSharedViews/${SPACE_A}`), {
      views: [{ name: 'All Tasks', filters: {} }],
    });

    await setDoc(doc(db, `orgs/${ORG_ID}/spaceSharedViews/${SPACE_B}`), {
      views: [{ name: 'Active', filters: { status: 'active' } }],
    });
  });
});

// ============================================================
// TEST 1: Block create/update task with listId from another space
// ============================================================

describe('1. Cross-space listId blocked on tasks', () => {
  it('BLOCK: create task in space-a with listId from space-b', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'tasks/new-task-1'), {
        orgId: ORG_ID,
        teamId: SPACE_A,
        listId: 'list-b1', // belongs to space-b — MUST FAIL
        title: 'Cross-space task',
        status: 'todo',
      })
    );
  });

  it('ALLOW: create task in space-a with listId from space-a', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'tasks/new-task-2'), {
        orgId: ORG_ID,
        teamId: SPACE_A,
        listId: 'list-a1', // same space — MUST SUCCEED
        title: 'Same-space task',
        status: 'todo',
      })
    );
  });

  it('ALLOW: create task with null listId (unsorted)', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'tasks/new-task-3'), {
        orgId: ORG_ID,
        teamId: SPACE_A,
        listId: null,
        title: 'Unsorted task',
        status: 'todo',
      })
    );
  });

  it('BLOCK: update task listId to a list in different space', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      updateDoc(doc(db, 'tasks/task-a1'), {
        listId: 'list-b1', // cross-space — MUST FAIL
      })
    );
  });

  it('ALLOW: update task listId to a list in same space', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'tasks/task-a1'), {
        listId: 'list-a1', // same value, same space — MUST SUCCEED
      })
    );
  });

  it('ALLOW: update task listId to null (unsort)', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'tasks/task-a1'), {
        listId: null, // unsort — MUST SUCCEED
      })
    );
  });
});

// ============================================================
// TEST 2: Block read of spaceSharedViews outside user's space
// ============================================================

describe('2. spaceSharedViews space-level isolation', () => {
  it('ALLOW: member-a reads shared views of space-a (their space)', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      getDoc(doc(db, `orgs/${ORG_ID}/spaceSharedViews/${SPACE_A}`))
    );
  });

  it('BLOCK: member-a reads shared views of space-b (not their space)', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      getDoc(doc(db, `orgs/${ORG_ID}/spaceSharedViews/${SPACE_B}`))
    );
  });

  it('ALLOW: owner reads shared views of any space', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      getDoc(doc(db, `orgs/${ORG_ID}/spaceSharedViews/${SPACE_B}`))
    );
  });

  it('BLOCK: member-a writes shared views of space-a (member, not manager)', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      setDoc(doc(db, `orgs/${ORG_ID}/spaceSharedViews/${SPACE_A}`), {
        views: [{ name: 'Hacked View', filters: {} }],
      })
    );
  });

  it('ALLOW: manager writes shared views of space-a (their space)', async () => {
    const db = testEnv.authenticatedContext(MANAGER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, `orgs/${ORG_ID}/spaceSharedViews/${SPACE_A}`), {
        views: [{ name: 'Manager View', filters: {} }],
      })
    );
  });

  it('BLOCK: manager writes shared views of space-b (not their space)', async () => {
    const db = testEnv.authenticatedContext(MANAGER_UID).firestore();
    await assertFails(
      setDoc(doc(db, `orgs/${ORG_ID}/spaceSharedViews/${SPACE_B}`), {
        views: [{ name: 'Cross-space write', filters: {} }],
      })
    );
  });
});

// ============================================================
// TEST 3: Allow manager+ to create folder/list
// ============================================================

describe('3. Manager+ can create folder/list', () => {
  it('ALLOW: manager creates folder', async () => {
    const db = testEnv.authenticatedContext(MANAGER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'folders/new-folder-1'), {
        orgId: ORG_ID,
        spaceId: SPACE_A,
        name: 'New Folder',
        position: 1,
      })
    );
  });

  it('ALLOW: owner creates folder', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'folders/new-folder-2'), {
        orgId: ORG_ID,
        spaceId: SPACE_A,
        name: 'Owner Folder',
        position: 2,
      })
    );
  });

  it('ALLOW: manager creates list', async () => {
    const db = testEnv.authenticatedContext(MANAGER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'lists/new-list-1'), {
        orgId: ORG_ID,
        spaceId: SPACE_A,
        name: 'New List',
        position: 1,
      })
    );
  });

  it('ALLOW: owner creates list', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'lists/new-list-2'), {
        orgId: ORG_ID,
        spaceId: SPACE_A,
        name: 'Owner List',
        position: 2,
      })
    );
  });
});

// ============================================================
// TEST 4: Block member from creating folder/list
// ============================================================

describe('4. Member BLOCKED from creating folder/list', () => {
  it('BLOCK: member creates folder', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'folders/member-folder'), {
        orgId: ORG_ID,
        spaceId: SPACE_A,
        name: 'Member Folder',
        position: 10,
      })
    );
  });

  it('BLOCK: member creates list', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'lists/member-list'), {
        orgId: ORG_ID,
        spaceId: SPACE_A,
        name: 'Member List',
        position: 10,
      })
    );
  });
});

// ============================================================
// TEST 5: Allow member to read structure in their space
// ============================================================

describe('5. Member can read folders/lists in their space', () => {
  it('ALLOW: member-a reads folder in space-a', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      getDoc(doc(db, 'folders/folder-a1'))
    );
  });

  it('BLOCK: member-a reads folder in space-b', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      getDoc(doc(db, 'folders/folder-b1'))
    );
  });

  it('ALLOW: member-a reads list in space-a', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      getDoc(doc(db, 'lists/list-a1'))
    );
  });

  it('BLOCK: member-a reads list in space-b', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      getDoc(doc(db, 'lists/list-b1'))
    );
  });

  it('ALLOW: member-a reads task in space-a', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      getDoc(doc(db, 'tasks/task-a1'))
    );
  });

  it('ALLOW: owner reads folder in any space', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      getDoc(doc(db, 'folders/folder-b1'))
    );
  });
});

// ============================================================
// TEST 6: Block member from updating (rename/move/reorder) folder/list
// ============================================================

describe('6. Member BLOCKED from updating (rename/move/reorder) folder/list', () => {
  it('BLOCK: member renames folder', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      updateDoc(doc(db, 'folders/folder-a1'), { name: 'Renamed by member' })
    );
  });

  it('BLOCK: member reorders folder (position change)', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      updateDoc(doc(db, 'folders/folder-a1'), { position: 99 })
    );
  });

  it('BLOCK: member renames list', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      updateDoc(doc(db, 'lists/list-a1'), { name: 'Renamed by member' })
    );
  });

  it('BLOCK: member moves list to folder (folderId change)', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      updateDoc(doc(db, 'lists/list-a1'), { folderId: 'folder-a1' })
    );
  });

  it('BLOCK: member reorders list (position change)', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      updateDoc(doc(db, 'lists/list-a1'), { position: 99 })
    );
  });
});

// ============================================================
// TEST 7: Allow manager+ to update (rename/move/reorder) folder/list
// ============================================================

describe('7. Manager+ CAN update (rename/move/reorder) folder/list', () => {
  it('ALLOW: manager renames folder', async () => {
    const db = testEnv.authenticatedContext(MANAGER_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'folders/folder-a1'), { name: 'Renamed by manager' })
    );
  });

  it('ALLOW: manager reorders folder', async () => {
    const db = testEnv.authenticatedContext(MANAGER_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'folders/folder-a1'), { position: 5 })
    );
  });

  it('ALLOW: manager renames list', async () => {
    const db = testEnv.authenticatedContext(MANAGER_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'lists/list-a1'), { name: 'Renamed by manager' })
    );
  });

  it('ALLOW: manager moves list to folder', async () => {
    const db = testEnv.authenticatedContext(MANAGER_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'lists/list-a1'), { folderId: 'folder-a1' })
    );
  });

  it('ALLOW: owner updates folder in space-b (admin bypass)', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'folders/folder-b1'), { name: 'Owner renamed B folder' })
    );
  });
});

// ============================================================
// TEST 8: Docs cross-space folderId validation
// ============================================================

describe('8. Docs cross-space folderId validation', () => {
  it('ALLOW: create doc with folderId in same space', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'docs/doc-new-1'), {
        orgId: ORG_ID, teamId: SPACE_A, title: 'Doc in A', content: '',
        folderId: 'folder-a1', // same space
      })
    );
  });

  it('BLOCK: create doc with folderId from different space', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'docs/doc-new-2'), {
        orgId: ORG_ID, teamId: SPACE_A, title: 'Cross-space doc', content: '',
        folderId: 'folder-b1', // different space — MUST FAIL
      })
    );
  });

  it('ALLOW: create doc with null folderId (space-level)', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'docs/doc-new-3'), {
        orgId: ORG_ID, teamId: SPACE_A, title: 'Space-level doc', content: '',
        folderId: null,
      })
    );
  });

  it('ALLOW: create doc without folderId field at all', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'docs/doc-new-4'), {
        orgId: ORG_ID, teamId: SPACE_A, title: 'No folder doc', content: '',
      })
    );
  });
});

// ============================================================
// TEST 9: Whiteboards cross-space folderId validation + team isolation
// ============================================================

describe('9. Whiteboards cross-space folderId + team isolation', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'whiteboards/wb-a1'), {
        orgId: ORG_ID, teamId: SPACE_A, name: 'Board A', folderId: null,
      });
      await setDoc(doc(db, 'whiteboards/wb-b1'), {
        orgId: ORG_ID, teamId: SPACE_B, name: 'Board B', folderId: null,
      });
    });
  });

  it('ALLOW: member-a reads whiteboard in space-a', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(getDoc(doc(db, 'whiteboards/wb-a1')));
  });

  it('BLOCK: member-a reads whiteboard in space-b (team isolation)', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(getDoc(doc(db, 'whiteboards/wb-b1')));
  });

  it('ALLOW: owner reads whiteboard in any space (admin bypass)', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(getDoc(doc(db, 'whiteboards/wb-b1')));
  });

  it('ALLOW: create whiteboard with folderId in same space', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'whiteboards/wb-new-1'), {
        orgId: ORG_ID, teamId: SPACE_A, name: 'New WB', folderId: 'folder-a1',
      })
    );
  });

  it('BLOCK: create whiteboard with folderId from different space', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      setDoc(doc(db, 'whiteboards/wb-new-2'), {
        orgId: ORG_ID, teamId: SPACE_A, name: 'Cross-space WB', folderId: 'folder-b1',
      })
    );
  });

  it('ALLOW: create whiteboard with null folderId', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'whiteboards/wb-new-3'), {
        orgId: ORG_ID, teamId: SPACE_A, name: 'Space WB', folderId: null,
      })
    );
  });
});

// ============================================================
// TEST 10: Doc/Whiteboard folderId move requires manager+
// ============================================================

describe('10. Doc/Whiteboard folderId move requires manager+', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      // Doc in folder-a1
      await setDoc(doc(db, 'docs/doc-move-1'), {
        orgId: ORG_ID, teamId: SPACE_A, title: 'Movable Doc', content: '', folderId: 'folder-a1',
      });
      // Whiteboard in folder-a1
      await setDoc(doc(db, 'whiteboards/wb-move-1'), {
        orgId: ORG_ID, teamId: SPACE_A, name: 'Movable WB', folderId: 'folder-a1',
      });
      // Doc at space root
      await setDoc(doc(db, 'docs/doc-root-1'), {
        orgId: ORG_ID, teamId: SPACE_A, title: 'Root Doc', content: '', folderId: null,
      });
    });
  });

  // Member CAN update content (no folderId change)
  it('ALLOW: member updates doc title (no folderId change)', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'docs/doc-move-1'), { title: 'Renamed by member' })
    );
  });

  // Member BLOCKED from moving doc to different folder
  it('BLOCK: member moves doc to different folder', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      updateDoc(doc(db, 'docs/doc-move-1'), { folderId: null })
    );
  });

  // Member BLOCKED from moving doc from root to folder
  it('BLOCK: member moves doc from root into folder', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      updateDoc(doc(db, 'docs/doc-root-1'), { folderId: 'folder-a1' })
    );
  });

  // Manager CAN move doc
  it('ALLOW: manager moves doc to different folder', async () => {
    const db = testEnv.authenticatedContext(MANAGER_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'docs/doc-move-1'), { folderId: null })
    );
  });

  // Manager CAN move doc from root to folder
  it('ALLOW: manager moves doc from root into folder', async () => {
    const db = testEnv.authenticatedContext(MANAGER_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'docs/doc-root-1'), { folderId: 'folder-a1' })
    );
  });

  // Member CAN update whiteboard name (no folderId change)
  it('ALLOW: member updates whiteboard name (no folderId change)', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'whiteboards/wb-move-1'), { name: 'Renamed by member' })
    );
  });

  // Member BLOCKED from moving whiteboard
  it('BLOCK: member moves whiteboard to root', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A_UID).firestore();
    await assertFails(
      updateDoc(doc(db, 'whiteboards/wb-move-1'), { folderId: null })
    );
  });

  // Manager CAN move whiteboard
  it('ALLOW: manager moves whiteboard to root', async () => {
    const db = testEnv.authenticatedContext(MANAGER_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'whiteboards/wb-move-1'), { folderId: null })
    );
  });
});
