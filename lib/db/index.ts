// ================================================================
// lib/db barrel — backward-compatible re-export of all domain modules
// ================================================================
// Import path '@/lib/db' continues to work unchanged.
// Each domain module is now independently testable and maintainable.

export { ORG, serverTimestamp } from './helpers';

export * from './members';
export * from './spaces';
export * from './tasks';
export * from './docs';
export * from './goals';
export * from './time';
export * from './whiteboards';
export * from './forms';
export * from './chat';
export * from './settings';
