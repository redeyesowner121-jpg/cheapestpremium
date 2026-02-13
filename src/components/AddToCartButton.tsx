import React, { useState } from 'react';
import { ShoppingCart, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AddToCartButtonProps {
  productId: string;
  variationId?: string | null;
  quantity?: number;
  disabled?: boolean;
  size?: 'sm' | 'default' | 'icon';
  className?: string;
}

const AddToCartButton: React.FC<AddToCartButtonProps> = ({
  productId,
  variationId,
  quantity = 1,
  disabled = false,
  size = 'default',
  className = '',
}) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      navigate('/auth');
      return;
    }

    setAdding(true);
    const success = await addToCart(productId, variationId, quantity);
    setAdding(false);

    if (success) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  };

  if (size === 'icon') {
    return (
      <button
        onClick={handleClick}
        disabled={disabled || adding}
        className={`p-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors active:scale-90 ${disabled ? 'opacity-50' : ''} ${className}`}
      >
        {added ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <ShoppingCart className="w-4 h-4 text-primary" />
        )}
      </button>
    );
  }

  if (size === 'sm') {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={disabled || adding}
        className={`h-7 px-3 text-xs rounded-lg ${className}`}
      >
        {added ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3.5 h-3.5" />}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || adding}
      className={`rounded-xl h-12 btn-gradient ${className}`}
    >
      {added ? (
        <>
          <Check className="w-5 h-5 mr-2 text-green-300" />
          Added!
        </>
      ) : (
        <>
          <ShoppingCart className="w-5 h-5 mr-2" />
          {disabled ? 'Out of Stock' : 'Add to Cart'}
        </>
      )}
    </Button>
  );
};

export default AddToCartButton;
