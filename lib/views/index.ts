export {
  type ViewProps,
  type ViewCapabilities,
  type ViewEntry,
  registerView,
  getView,
  getAllViews,
  hasView,
} from './view-registry';

// Side-effect: register built-in views (list, board, calendar)
export { } from './register-views';
