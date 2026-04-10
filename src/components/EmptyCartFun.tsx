import React, { useState, useEffect } from 'react';
import { ShoppingCart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const funnyMessages = [
  "Kis colour ke chaddi pehne ho? 🫠",
  "Cart khali hai bro… wallet bhi khali hai kya? 💀",
  "Arre shopping kar na, kya soch raha hai? 🤔",
  "Tere dost sab premium use kar rahe, tu kya kar raha? 😏",
  "Paise bachane se Netflix nahi milega bhai 😂",
  "Cart mein kuch daal, life mein kuch kaam kar 🫡",
  "Bina shopping ke life boring hai yaar 🥱",
  "Sab log buy kar rahe, tu kab karega? 🛒",
  "Tera cart rota hai bhai… kuch toh daal 🥺",
  "Premium lele, crush impress hoga 😎",
  "Khali cart = khali life? 🤷‍♂️",
  "Aaj ka offer miss karoge toh kal regret karoge 😤",
  "Bhai kuch le na, itna sasta kahan milega? 🔥",
  "Cart itna khali ki echo aa raha hai 📢",
  "Shopping na karna is a crime, bro 🚔",
  "Tujhe dekhke cart ro raha hai 😭",
  "Abhi le, baad mein price badh jayega ⏰",
  "Dost bolenge — 'tu toh smart hai!' 🧠",
  "Ek baar try kar, phir dekhna magic ✨",
  "Cart mein love daal, products daal 💕",
];

const emojis = ['🛍️', '💸', '🎁', '🎉', '✨', '🔥', '💎', '🫶', '🤩', '😜'];

const EmptyCartFun: React.FC = () => {
  const navigate = useNavigate();
  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * funnyMessages.length));
  const [fadeKey, setFadeKey] = useState(0);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string; left: number; delay: number }[]>([]);

  // Rotate messages every 3.5s
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(prev => {
        let next;
        do { next = Math.floor(Math.random() * funnyMessages.length); } while (next === prev);
        return next;
      });
      setFadeKey(k => k + 1);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Generate floating emojis
  useEffect(() => {
    const arr = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      left: 10 + Math.random() * 80,
      delay: Math.random() * 3,
    }));
    setFloatingEmojis(arr);
  }, []);

  return (
    <div className="text-center py-8 relative overflow-hidden">
      {/* Floating emojis */}
      {floatingEmojis.map(e => (
        <span
          key={e.id}
          className="absolute text-2xl pointer-events-none opacity-20"
          style={{
            left: `${e.left}%`,
            animation: `floatUp 4s ease-in-out ${e.delay}s infinite`,
            top: '80%',
          }}
        >
          {e.emoji}
        </span>
      ))}

      {/* Cute bouncing cart */}
      <div className="relative mx-auto w-28 h-28 mb-6">
        <div
          className="absolute inset-0 rounded-full bg-primary/10"
          style={{ animation: 'pulse 2s ease-in-out infinite' }}
        />
        <div
          className="absolute inset-2 rounded-full bg-primary/5 flex items-center justify-center"
          style={{ animation: 'cartBounce 2s ease-in-out infinite' }}
        >
          <ShoppingCart className="w-12 h-12 text-primary/40" />
        </div>
        {/* Sparkle effects */}
        <Sparkles
          className="absolute -top-1 -right-1 w-5 h-5 text-accent"
          style={{ animation: 'sparkle 1.5s ease-in-out infinite' }}
        />
        <Sparkles
          className="absolute -bottom-1 -left-2 w-4 h-4 text-primary"
          style={{ animation: 'sparkle 1.8s ease-in-out 0.5s infinite' }}
        />
      </div>

      {/* Rotating funny message */}
      <div className="min-h-[4rem] flex items-center justify-center px-4">
        <p
          key={fadeKey}
          className="text-lg font-bold text-foreground/80 max-w-[280px]"
          style={{ animation: 'messageIn 0.5s ease-out' }}
        >
          {funnyMessages[msgIndex]}
        </p>
      </div>

      <p className="text-sm text-muted-foreground mt-2 mb-6">
        Kuch toh daal cart mein, bro! 🛒
      </p>

      <Button
        onClick={() => navigate('/products')}
        className="btn-gradient rounded-xl px-8 gap-2"
        style={{ animation: 'cartBounce 3s ease-in-out infinite' }}
      >
        <Sparkles className="w-4 h-4" />
        Shop Now 🔥
      </Button>

      {/* Inline keyframes */}
      <style>{`
        @keyframes floatUp {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.15; }
          50% { transform: translateY(-120px) rotate(20deg); opacity: 0.35; }
        }
        @keyframes cartBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes sparkle {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.6; }
          50% { transform: scale(1.3) rotate(15deg); opacity: 1; }
        }
        @keyframes messageIn {
          0% { opacity: 0; transform: translateY(12px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default EmptyCartFun;
