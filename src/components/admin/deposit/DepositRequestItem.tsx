import React from 'react';
import { Clock, CheckCircle, XCircle, User } from 'lucide-react';
import type { DepositRequest } from './deposit-actions';

interface DepositRequestItemProps {
  request: DepositRequest;
  onSelect: (request: DepositRequest) => void;
}

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'approved': return 'bg-success/10 text-success';
    case 'rejected': return 'bg-destructive/10 text-destructive';
    default: return 'bg-warning/10 text-warning';
  }
};

export const getStatusIcon = (status: string) => {
  switch (status) {
    case 'approved': return <CheckCircle className="w-4 h-4" />;
    case 'rejected': return <XCircle className="w-4 h-4" />;
    default: return <Clock className="w-4 h-4" />;
  }
};

const DepositRequestItem: React.FC<DepositRequestItemProps> = ({ request, onSelect }) => (
  <div
    onClick={() => onSelect(request)}
    className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
  >
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
      <User className="w-5 h-5 text-emerald-600" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-foreground text-sm truncate">
        {request.profiles?.name || 'Unknown User'}
      </p>
      <p className="text-xs text-muted-foreground">TXN: {request.transaction_id}</p>
    </div>
    <div className="text-right">
      <p className="font-bold text-foreground">₹{request.amount}</p>
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${getStatusColor(request.status)}`}>
        {getStatusIcon(request.status)}
        {request.status}
      </span>
    </div>
  </div>
);

export default DepositRequestItem;
