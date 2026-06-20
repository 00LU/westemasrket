import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

function resolveRouteByRole(role) {
  return role === 'admin' ? '/admin/users' : `/${role}`;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    companyName: '',
    piva: '',
    registeredOffice: '',
    contactPerson: '',
    email: '',
    password: '',
    role: 'producer',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (field) => (event) => {
    setForm((curr) => ({ ...curr, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register({
        role: form.role,
        companyName: form.companyName,
        piva: form.piva,
        email: form.email,
        password: form.password,
      });
      navigate(resolveRouteByRole(user.role));
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed. Check provided data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form className="w-full max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft" onSubmit={handleSubmit}>
        <h1 className="font-display text-2xl font-bold text-brand-900">Company Registration</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Company Name" value={form.companyName} onChange={updateField('companyName')} required />
          <Input label="P.IVA" value={form.piva} onChange={updateField('piva')} required />
          <Input label="Registered Office" value={form.registeredOffice} onChange={updateField('registeredOffice')} />
          <Input label="Contact Person" value={form.contactPerson} onChange={updateField('contactPerson')} />
          <Input label="Email" type="email" value={form.email} onChange={updateField('email')} required />
          <Input label="Password" type="password" value={form.password} onChange={updateField('password')} required />
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Role
          <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.role} onChange={updateField('role')} required>
            <option value="producer">Producer</option>
            <option value="transporter">Transporter</option>
            <option value="recipient">Recipient</option>
          </select>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit for Verification'}</Button>
        <p className="text-sm text-slate-600">
          Already registered? <Link className="font-semibold text-brand-900" to="/auth/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
