import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { isAccessTokenValid } from '@/lib/jwt';
import { LoginApiError } from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';

export const LoginPage = () => {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAccessTokenValid(token)) {
    return <Navigate to="/inicio" replace />;
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/inicio', { replace: true });
    } catch (e) {
      if (e instanceof LoginApiError) {
        if (e.status === 401) {
          setError('Usuario o contraseña incorrectos.');
        } else if (e.status === 429) {
          setError(
            'Demasiados intentos fallidos. Esperá unos minutos antes de reintentar.',
          );
        } else {
          setError(
            'No se pudo iniciar sesión por un error del servidor. Intentá nuevamente.',
          );
        }
      } else {
        setError(
          'No se pudo conectar con el servidor. Verificá tu conexión a internet e intentá nuevamente.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#e2f2ee_0,_#f6f7f5_45%,_#f6f7f5_100%)] px-4 py-10 text-slate-900">
      <div className="w-full max-w-md rounded-3xl border border-teal-100 bg-white/90 p-8 shadow-[0_18px_40px_-35px_rgba(15,118,110,0.6)]">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">NoSignal</p>
        <h1 className="mt-2 text-2xl font-semibold">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-slate-600">
          Necesitás conexión para obtener el token. El formulario offline valida la expiración del JWT en el
          dispositivo.
        </p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            Usuario
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            Contraseña
            <input
              type="password"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading} className="bg-slate-900 text-white hover:bg-slate-800">
            {loading ? 'Ingresando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
};
