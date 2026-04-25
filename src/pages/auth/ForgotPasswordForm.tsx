import React from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  recoveryEmail: string;
  setRecoveryEmail: (v: string) => void;
  recoverySending: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

const ForgotPasswordForm: React.FC<Props> = ({ recoveryEmail, setRecoveryEmail, recoverySending, onBack, onSubmit }) => (
  <div className="space-y-4">
    <button type="button" onClick={onBack}
      className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
      <ArrowLeft className="w-4 h-4" />Back to Login
    </button>
    <p className="text-sm text-muted-foreground">
      Enter your email address and we'll send a recovery request to the admin. They will contact you to help reset your password.
    </p>
    <div className="relative">
      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      <Input type="email" placeholder="Your Email Address" value={recoveryEmail}
        onChange={(e) => setRecoveryEmail(e.target.value)}
        className="pl-12 h-12 rounded-xl bg-muted border-0" required />
    </div>
    <Button type="button" className="w-full h-12 btn-gradient rounded-xl font-semibold"
      disabled={recoverySending} onClick={onSubmit}>
      {recoverySending ? 'Sending...' : 'Send Recovery Request'}
    </Button>
  </div>
);

export default ForgotPasswordForm;
