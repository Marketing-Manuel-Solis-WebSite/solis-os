// Firebase Auth error codes → friendly messages via i18n
// Shared between login, forgot-password and reset-password
import { translate } from '@/lib/i18n';
import type { Lang } from '@/lib/translations';

export function accessErrors(lang: Lang): Record<string, { title: string; msg: string }> {
  return {
    no_account: { title: translate(lang, 'authError.noAccess'), msg: translate(lang, 'authError.noAccessMsg') },
    deactivated: { title: translate(lang, 'authError.deactivated'), msg: translate(lang, 'authError.deactivatedMsg') },
  };
}

/** @deprecated Use accessErrors(lang) instead — kept for backward compat */
export const ACCESS_ERRORS: Record<string, { title: string; msg: string }> = {
  no_account: { title: 'Sin acceso', msg: 'No tienes una cuenta registrada. Contacta a tu administrador para que te de acceso al sistema.' },
  deactivated: { title: 'Cuenta desactivada', msg: 'Tu cuenta fue desactivada por un administrador. Contacta a soporte si crees que es un error.' },
};

export function friendlyError(raw: string, lang: Lang = 'es'): { title: string; msg: string } {
  const code = raw.match(/\(auth\/([^)]+)\)/)?.[1] || '';
  switch (code) {
    // Login
    case 'invalid-credential':
    case 'wrong-password':
      return { title: translate(lang, 'authError.invalidCredentials'), msg: translate(lang, 'authError.invalidCredentialsMsg') };
    case 'user-not-found':
      return { title: translate(lang, 'authError.userNotFound'), msg: translate(lang, 'authError.userNotFoundMsg') };
    case 'too-many-requests':
      return { title: translate(lang, 'authError.tooManyAttempts'), msg: translate(lang, 'authError.tooManyAttemptsMsg') };
    case 'user-disabled':
      return { title: translate(lang, 'authError.accountDisabled'), msg: translate(lang, 'authError.accountDisabledMsg') };
    case 'invalid-email':
      return { title: translate(lang, 'authError.invalidEmail'), msg: translate(lang, 'authError.invalidEmailMsg') };
    case 'network-request-failed':
      return { title: translate(lang, 'authError.networkError'), msg: translate(lang, 'authError.networkErrorMsg') };
    case 'popup-closed-by-user':
      return { title: translate(lang, 'authError.popupClosed'), msg: translate(lang, 'authError.popupClosedMsg') };
    // Reset password
    case 'expired-action-code':
      return { title: translate(lang, 'authError.expiredLink'), msg: translate(lang, 'authError.expiredLinkMsg') };
    case 'invalid-action-code':
      return { title: translate(lang, 'authError.invalidLink'), msg: translate(lang, 'authError.invalidLinkMsg') };
    case 'weak-password':
      return { title: translate(lang, 'authError.weakPassword'), msg: translate(lang, 'authError.weakPasswordMsg') };
    default:
      return { title: translate(lang, 'authError.genericError'), msg: translate(lang, 'authError.genericErrorMsg') };
  }
}
