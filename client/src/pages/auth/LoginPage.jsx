import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import AuthLayout from '../../components/shared/AuthLayout';
import StatusAlert from '../../components/ui/StatusAlert';
import { useAuth } from '../../context/AuthContext';

function resolveRouteByRole(role) {
  return role === 'admin' ? '/admin/users' : `/${role}`;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login({ email, password });
      navigate(resolveRouteByRole(user.role));
    } catch (err) {
      setError(err?.response?.data?.message || 'Accesso non riuscito. Controlla le credenziali inserite.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <form className="w-full max-w-md space-y-4 rounded-2xl bg-white p-8 shadow-soft" onSubmit={handleSubmit}>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Accedi a WasteMarket</h1>
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Input label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <StatusAlert variant="error">{error}</StatusAlert>}
        <Button className="w-full" type="submit" disabled={loading}>{loading ? 'Accesso in corso...' : 'Entra nella piattaforma'}</Button>
        <p className="text-sm text-slate-600">
          Non hai un account? <Link className="font-semibold text-brand-900" to="/auth/register">Registra la tua azienda</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
