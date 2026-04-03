import React, { useState } from 'react';
import { ArrowLeft, Shield, AlertTriangle, RefreshCw, Ban, Video, Clock, Lock, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';

const sections = [
  {
    icon: <Globe className="w-5 h-5" />,
    titleEn: 'Reseller Status',
    titleBn: 'রিসেলার স্ট্যাটাস',
    contentEn: 'We are strictly Resellers, not the original service providers or vendors. We do not own the platforms (like YouTube, Netflix, etc.); we only provide access/subscriptions at a cheaper rate.',
    contentBn: 'আমরা কোনো সার্ভিসের মূল মালিক বা ভেন্ডর নই, আমরা কেবল রিসেলার (Reseller)। আমরা বিভিন্ন প্ল্যাটফর্মের (যেমন: YouTube, Netflix ইত্যাদি) সাবস্ক্রিপশন সস্তায় সরবরাহ করি মাত্র।',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    titleEn: 'Warranty Policy',
    titleBn: 'ওয়ারেন্টি পলিসি',
    contentEn: 'No warranty is provided for Cheap/Budget products. Please purchase these at your own risk. For premium or high-tier products, warranty details will be mentioned in the product description.',
    contentBn: 'যেসকল প্রোডাক্টের দাম তুলনামূলক অনেক কম (Cheap Products), সেগুলোর কোনো ওয়ারেন্টি প্রদান করা হয় না। দামী প্রোডাক্টের ক্ষেত্রে ওয়ারেন্টি থাকলে তা ডেসক্রিপশনে লেখা থাকবে।',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
  },
  {
    icon: <RefreshCw className="w-5 h-5" />,
    titleEn: 'Replacement Policy',
    titleBn: 'রিপ্লেসমেন্ট পলিসি',
    contentEn: 'If you encounter a genuine problem, a Replacement may be provided depending on the situation and stock availability. However, this is not guaranteed for every product.',
    contentBn: 'কোনো অ্যাকাউন্টে সমস্যা দেখা দিলে পরিস্থিতির ওপর ভিত্তি করে এবং স্টক থাকা সাপেক্ষে রিপ্লেসমেন্ট দেওয়া হতে পারে। তবে সব প্রোডাক্টের ক্ষেত্রে এটি প্রযোজ্য নয়।',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    icon: <Ban className="w-5 h-5" />,
    titleEn: 'No Refund Policy',
    titleBn: 'রিফান্ড পলিসি',
    contentEn: 'Once a product is delivered, No Refunds will be issued under any circumstances. Please double-check before making a payment.',
    contentBn: 'প্রোডাক্ট ডেলিভারি হয়ে যাওয়ার পর কোনো অবস্থাতেই টাকা ফেরত (Refund) দেওয়া হবে না। কেনার আগে ভেবে-চিন্তে অর্ডার করুন।',
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
  {
    icon: <Video className="w-5 h-5" />,
    titleEn: 'Screen Recording Proof',
    titleBn: 'ভিডিও প্রুফ',
    contentEn: 'To claim a replacement for a faulty account, you must provide a continuous screen recording from the moment of payment/delivery to the login attempt. Without video proof, no claims will be entertained.',
    contentBn: 'রিপ্লেসমেন্ট পেতে হলে পেমেন্ট/ডেলিভারি পাওয়ার মুহূর্ত থেকে লগইন করা পর্যন্ত একটি টানা স্ক্রিন রেকর্ডিং দেখাতে হবে। ভিডিও ছাড়া কোনো অভিযোগ গ্রহণ করা হবে না।',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    icon: <Clock className="w-5 h-5" />,
    titleEn: 'Delivery Time',
    titleBn: 'ডেলিভারি সময়',
    contentEn: 'Most products are delivered instantly. However, in case of technical issues, it may take up to 24-48 hours.',
    contentBn: 'সাধারণত পেমেন্টের পর দ্রুত ডেলিভারি দেওয়া হয়। তবে কারিগরি সমস্যার কারণে কখনো কখনো ২৪ থেকে ৪৮ ঘণ্টা সময় লাগতে পারে।',
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
  },
  {
    icon: <Lock className="w-5 h-5" />,
    titleEn: 'Account Rules',
    titleBn: 'অ্যাকাউন্ট নিয়মাবলী',
    contentEn: 'If you change the password or email of a shared account, your access will be terminated immediately without a refund or replacement.',
    contentBn: 'শেয়ারড অ্যাকাউন্টের ক্ষেত্রে পাসওয়ার্ড বা ইমেইল পরিবর্তন করার চেষ্টা করলে আপনার অ্যাক্সেস সাথে সাথে বন্ধ করে দেওয়া হবে এবং কোনো রিপ্লেসমেন্ট দেওয়া হবে না।',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
];

const TermsPage: React.FC = () => {
  const navigate = useNavigate();
  const [lang, setLang] = useState<'en' | 'bn'>('en');

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        {/* Back + Title */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">
            {lang === 'en' ? 'Terms & Conditions' : 'শর্তাবলী ও নিয়মাবলী'}
          </h1>
        </div>

        {/* Language Toggle */}
        <div className="flex gap-2 mb-6">
          <Button
            size="sm"
            variant={lang === 'en' ? 'default' : 'outline'}
            className="rounded-full text-xs"
            onClick={() => setLang('en')}
          >
            🇬🇧 English
          </Button>
          <Button
            size="sm"
            variant={lang === 'bn' ? 'default' : 'outline'}
            className="rounded-full text-xs"
            onClick={() => setLang('bn')}
          >
            🇧🇩 বাংলা
          </Button>
        </div>

        {/* Warning Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 mb-6 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive font-medium">
            {lang === 'en'
              ? 'By using our services, you agree to all the terms below. Please read carefully before purchasing.'
              : 'আমাদের সেবা ব্যবহার করে আপনি নিচের সকল শর্তে সম্মত হচ্ছেন। কেনার আগে অনুগ্রহ করে মনোযোগ দিয়ে পড়ুন।'}
          </p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-3">
          {sections.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center ${s.color}`}>
                  {s.icon}
                </div>
                <h3 className="font-semibold text-foreground text-sm">
                  {lang === 'en' ? s.titleEn : s.titleBn}
                </h3>
              </div>
              <p className="text-muted-foreground text-[13px] leading-relaxed pl-12">
                {lang === 'en' ? s.contentEn : s.contentBn}
              </p>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8 mb-4">
          {lang === 'en'
            ? 'Last updated: April 2026'
            : 'সর্বশেষ আপডেট: এপ্রিল ২০২৬'}
        </p>
      </main>
      <BottomNav />
    </div>
  );
};

export default TermsPage;
