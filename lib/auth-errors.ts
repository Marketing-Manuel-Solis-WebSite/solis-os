// Firebase Auth error codes → mensajes amigables en español
// Compartido entre login, forgot-password y reset-password

export const ACCESS_ERRORS: Record<string, { title: string; msg: string }> = {
  no_account: { title: 'Sin acceso', msg: 'No tienes una cuenta registrada. Contacta a tu administrador para que te de acceso al sistema.' },
  deactivated: { title: 'Cuenta desactivada', msg: 'Tu cuenta fue desactivada por un administrador. Contacta a soporte si crees que es un error.' },
};

export function friendlyError(raw: string): { title: string; msg: string } {
  const code = raw.match(/\(auth\/([^)]+)\)/)?.[1] || '';
  switch (code) {
    // Login
    case 'invalid-credential':
    case 'wrong-password':
      return { title: 'Datos incorrectos', msg: 'El email o la contraseña que ingresaste no son correctos. Verifica tus datos e intenta de nuevo.' };
    case 'user-not-found':
      return { title: 'Cuenta no encontrada', msg: 'No existe una cuenta con ese email. Verifica que este bien escrito o contacta a tu administrador.' };
    case 'too-many-requests':
      return { title: 'Demasiados intentos', msg: 'Has intentado muchas veces. Espera unos minutos antes de volver a intentar.' };
    case 'user-disabled':
      return { title: 'Cuenta bloqueada', msg: 'Esta cuenta ha sido deshabilitada. Contacta a tu administrador.' };
    case 'invalid-email':
      return { title: 'Email invalido', msg: 'El formato del email no es correcto. Revisa que este bien escrito.' };
    case 'network-request-failed':
      return { title: 'Sin conexion', msg: 'No se pudo conectar al servidor. Revisa tu conexion a internet e intenta de nuevo.' };
    case 'popup-closed-by-user':
      return { title: 'Inicio cancelado', msg: 'Cerraste la ventana de Google antes de completar el inicio de sesion.' };
    // Reset password
    case 'expired-action-code':
      return { title: 'Enlace expirado', msg: 'Este enlace ha expirado. Solicita uno nuevo para restablecer tu contraseña.' };
    case 'invalid-action-code':
      return { title: 'Enlace invalido', msg: 'Este enlace no es valido o ya fue utilizado. Solicita uno nuevo.' };
    case 'weak-password':
      return { title: 'Contraseña debil', msg: 'La contraseña es muy corta. Debe tener al menos 8 caracteres.' };
    default:
      return { title: 'Algo salio mal', msg: 'Ocurrio un error inesperado. Intenta de nuevo en unos momentos.' };
  }
}
