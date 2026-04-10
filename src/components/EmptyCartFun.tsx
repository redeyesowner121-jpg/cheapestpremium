import React, { useState, useEffect } from 'react';
import { ShoppingCart, Sparkles, Heart, Star, Zap } from 'lucide-react';
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
  "Bhai free ka WiFi use karta hai, premium bhi free jaise hai 📶",
  "Itna sochega toh Buddha ho jayega 👴",
  "Cart khali = phone useless 📱",
  "Tere baap ka paisa nahi lagta, chill kar 😂",
  "Yahan sab sasta hai, Amazon se bhi zyada 🤑",
  "Tu Netflix pe kya dekhta hai? Buffering? Premium le! 📺",
  "Tera crush bhi premium use karta hai btw 👀",
  "Ek click mein life change ho sakti hai bro 🖱️",
  "Mummy ko bol — 'invest kar raha hoon' 🧐",
  "Abhi nahi toh kabhi nahi, samjha? ⚡",
  "Cart se zyada toh teri dating life khali hai 💔",
  "Bhai khareed le, refund bhi toh hai 🔄",
  "Soch mat, kar! — Nike wala attitude rakh 🏃",
  "Premium = productivity = success = lambo 🏎️",
  "Tere dost party kar rahe, tu cart khali dekh raha 🎉",
  "Arre yaar, ek product toh daal de sympathy mein 🥹",
  "Boss ne bola — 'khareed le warna fired' 👔",
  "Cart khali rakhne wale log pizza bhi plain khaate hain 🍕",
  "Bhai tu legend hai, legends shop karte hain 👑",
  "Itna sasta milega nahi, Chor Bazaar mein bhi nahi 🏪",
  "Tera phone bhi bol raha — 'kuch le na bhai' 📲",
  "Cart khali = Monday morning vibes 😩",
  "Ek premium le, personality 10x ho jayegi 💯",
  "Tu wahi hai na jo free trial ke baad uninstall karta hai? 🤡",
  "Bhai shopping therapy hai, doctor se puch 💊",
  "Tera cart itna khali ki Sahara Desert jealous hai 🏜️",
  "Aaj le, kal flex kar — simple formula 📐",
  "Bhai premium lega toh babes attract hongi 😘",
  "Cart khali rakhna = gym join karke na jaana 🏋️",
  "Arre champion, champions shop karte hain! 🏆",
];

const emojis = ['🛍️', '💸', '🎁', '🎉', '✨', '🔥', '💎', '🫶', '🤩', '😜', '🌈', '⭐', '🎀', '🦄', '🍭'];

const EmptyCartFun: React.FC = () => {
  const navigate = useNavigate();
  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * funnyMessages.length));
  const [fadeKey, setFadeKey] = useState(0);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string; left: number; delay: number; size: number }[]>([]);

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

  useEffect(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      left: 5 + Math.random() * 90,
      delay: Math.random() * 5,
      size: 16 + Math.random() * 20,
    }));
    setFloatingEmojis(arr);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl mx-2 my-4">
      {/* Colorful animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-pink-500/15 to-orange-400/20" />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 20% 30%, rgba(168,85,247,0.25) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(251,146,60,0.2) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(236,72,153,0.15) 0%, transparent 60%)',
        }}
      />
      {/* Animated color blobs */}
      <div
        className="absolute w-32 h-32 rounded-full blur-3xl"
        style={{
          background: 'linear-gradient(135deg, #a855f7, #ec4899)',
          top: '-10%', left: '-5%', opacity: 0.3,
          animation: 'blobMove1 6s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-28 h-28 rounded-full blur-3xl"
        style={{
          background: 'linear-gradient(135deg, #f97316, #eab308)',
          bottom: '-10%', right: '-5%', opacity: 0.3,
          animation: 'blobMove2 7s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-24 h-24 rounded-full blur-3xl"
        style={{
          background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
          top: '40%', right: '20%', opacity: 0.2,
          animation: 'blobMove3 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-20 h-20 rounded-full blur-2xl"
        style={{
          background: 'linear-gradient(135deg, #10b981, #34d399)',
          bottom: '20%', left: '15%', opacity: 0.25,
          animation: 'blobMove1 9s ease-in-out infinite reverse',
        }}
      />

      {/* Floating emojis */}
      {floatingEmojis.map(e => (
        <span
          key={e.id}
          className="absolute pointer-events-none"
          style={{
            left: `${e.left}%`,
            fontSize: `${e.size}px`,
            animation: `floatUp ${4 + Math.random() * 3}s ease-in-out ${e.delay}s infinite`,
            top: '85%',
            opacity: 0.3,
          }}
        >
          {e.emoji}
        </span>
      ))}

      {/* Sparkle particles */}
      {[...Array(8)].map((_, i) => (
        <div
          key={`spark-${i}`}
          className="absolute w-1 h-1 rounded-full"
          style={{
            background: ['#a855f7', '#ec4899', '#f97316', '#eab308', '#06b6d4', '#3b82f6', '#10b981', '#f43f5e'][i],
            left: `${10 + i * 12}%`,
            top: `${15 + (i % 3) * 25}%`,
            animation: `sparkleParticle ${2 + i * 0.3}s ease-in-out ${i * 0.4}s infinite`,
            boxShadow: `0 0 6px 2px ${['#a855f7', '#ec4899', '#f97316', '#eab308', '#06b6d4', '#3b82f6', '#10b981', '#f43f5e'][i]}40`,
          }}
        />
      ))}

      <div className="relative text-center py-10 px-4 z-10">
        {/* Cute bouncing cart with glow */}
        <div className="relative mx-auto w-32 h-32 mb-6">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(236,72,153,0.2), rgba(251,146,60,0.2))',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(236,72,153,0.1))',
              animation: 'pulse 2s ease-in-out 0.5s infinite',
              transform: 'scale(1.2)',
            }}
          />
          <div
            className="absolute inset-3 rounded-full backdrop-blur-sm flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.1))',
              animation: 'cartBounce 2s ease-in-out infinite',
              boxShadow: '0 0 30px rgba(168,85,247,0.2)',
            }}
          >
            <ShoppingCart className="w-14 h-14 text-purple-400/70" />
          </div>
          <Sparkles
            className="absolute -top-1 -right-1 w-6 h-6 text-yellow-400"
            style={{ animation: 'sparkle 1.5s ease-in-out infinite' }}
          />
          <Sparkles
            className="absolute -bottom-2 -left-2 w-5 h-5 text-pink-400"
            style={{ animation: 'sparkle 1.8s ease-in-out 0.5s infinite' }}
          />
          <Star
            className="absolute top-0 left-0 w-4 h-4 text-orange-400 fill-orange-400"
            style={{ animation: 'sparkle 2s ease-in-out 1s infinite' }}
          />
          <Heart
            className="absolute -bottom-1 right-2 w-4 h-4 text-red-400 fill-red-400"
            style={{ animation: 'sparkle 1.6s ease-in-out 0.3s infinite' }}
          />
          <Zap
            className="absolute top-2 -right-3 w-4 h-4 text-cyan-400"
            style={{ animation: 'sparkle 2.2s ease-in-out 0.8s infinite' }}
          />
        </div>

        {/* Rotating funny message */}
        <div className="min-h-[5rem] flex items-center justify-center px-2">
          <p
            key={fadeKey}
            className="text-lg font-bold max-w-[300px] drop-shadow-lg"
            style={{
              animation: 'messageIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
              background: 'linear-gradient(135deg, #c084fc, #f472b6, #fb923c)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {funnyMessages[msgIndex]}
          </p>
        </div>

        <p className="text-sm text-muted-foreground mt-1 mb-6 font-medium">
          Kuch toh daal cart mein, bro! 🛒✨
        </p>

        <Button
          onClick={() => navigate('/products')}
          className="rounded-xl px-8 gap-2 text-white font-bold shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #a855f7, #ec4899, #f97316)',
            animation: 'cartBounce 3s ease-in-out infinite',
            boxShadow: '0 4px 20px rgba(168,85,247,0.4)',
          }}
        >
          <Sparkles className="w-4 h-4" />
          Shop Now 🔥
        </Button>
      </div>

      <style>{`
        @keyframes floatUp {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.2; }
          50% { transform: translateY(-140px) rotate(25deg); opacity: 0.5; }
        }
        @keyframes cartBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes sparkle {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.5; }
          50% { transform: scale(1.4) rotate(20deg); opacity: 1; }
        }
        @keyframes messageIn {
          0% { opacity: 0; transform: translateY(16px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes blobMove1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.1); }
          66% { transform: translate(-15px, 15px) scale(0.9); }
        }
        @keyframes blobMove2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-25px, 15px) scale(1.15); }
          66% { transform: translate(20px, -10px) scale(0.85); }
        }
        @keyframes blobMove3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20px, -20px) scale(1.2); }
        }
        @keyframes sparkleParticle {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(2.5); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default EmptyCartFun;
