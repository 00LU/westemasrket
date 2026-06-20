import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
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
      setError(err?.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft" onSubmit={handleSubmit}>
        <h1 className="font-display text-2xl font-bold text-brand-900">WasteMarket Login</h1>
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Input label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Enter Platform'}</Button>
        <p className="text-sm text-slate-600">
          No account? <Link className="font-semibold text-brand-900" to="/auth/register">Register company</Link>
        </p>
      </form>
    </div>
  );
}
