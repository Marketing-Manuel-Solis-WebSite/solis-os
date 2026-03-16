// Real-time collaboration primitives
export { usePresence } from './presence';
export { useActiveViewers, joinViewing, leaveViewing, onActiveViewersSnapshot, type ActiveViewer } from './active-viewers';
export { useRealtimeDoc, type RealtimeDocState, type EditLock } from './use-realtime-doc';
export { useRealtimeTask, type RealtimeTaskState } from './use-realtime-task';
export { FirestoreYjsProvider, type FirestoreProviderOptions } from './firestore-yjs-provider';
