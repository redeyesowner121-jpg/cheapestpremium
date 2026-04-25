import React from 'react';
import { Mail, Lock, User, Phone, Eye, EyeOff, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface FormData {
  name: string; email: string; password: string; phone: string; referralCode: string;
}

interface Props {
  isLogin: boolean;
  formData: FormData;
  setFormData: (d: FormData) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
}

const EmailAuthForm: React.FC<Props> = ({
  isLogin, formData, setFormData, showPassword, setShowPassword,
  loading, onSubmit, onForgotPassword,
}) => (
  <form onSubmit={onSubmit} className="space-y-4">
    {!isLogin && (
      <>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input type="text" placeholder="Full Name" value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="pl-12 h-12 rounded-xl bg-muted border-0" required />
        </div>
        <div className="relative">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input type="tel" placeholder="Phone Number (optional)" value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="pl-12 h-12 rounded-xl bg-muted border-0" />
        </div>
      </>
    )}

    <div className="relative">
      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      <Input type="email" placeholder="Email Address" value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        className="pl-12 h-12 rounded-xl bg-muted border-0" required />
    </div>

    <div className="relative">
      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      <Input type={showPassword ? 'text' : 'password'} placeholder="Password" value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        className="pl-12 pr-12 h-12 rounded-xl bg-muted border-0" required minLength={6} />
      <button type="button" onClick={() => setShowPassword(!showPassword)}
        className="absolute right-4 top-1/2 -translate-y-1/2">
        {showPassword
          ? <EyeOff className="w-5 h-5 text-muted-foreground" />
          : <Eye className="w-5 h-5 text-muted-foreground" />}
      </button>
    </div>

    {!isLogin && (
      <div className="relative">
        <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input type="text" placeholder="Referral Code (Optional)" value={formData.referralCode}
          onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
          className="pl-12 h-12 rounded-xl bg-muted border-0 uppercase" />
      </div>
    )}

    {isLogin && (
      <div className="text-right">
        <button type="button" onClick={onForgotPassword} className="text-sm text-primary font-medium">
          Forgot Password?
        </button>
      </div>
    )}

    <Button type="submit" className="w-full h-12 btn-gradient rounded-xl font-semibold" disabled={loading}>
      {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
    </Button>
  </form>
);

export default EmailAuthForm;
