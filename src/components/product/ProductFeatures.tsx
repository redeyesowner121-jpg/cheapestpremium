import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Truck, MessageCircle } from 'lucide-react';

const ProductFeatures: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="grid grid-cols-3 gap-3"
    >
      <div className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-2xl border border-green-200 dark:border-green-800">
        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-green-600" />
        </div>
        <span className="text-xs text-center font-medium text-green-700 dark:text-green-300">Secure Payment</span>
      </div>
      <div className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-2xl border border-blue-200 dark:border-blue-800">
        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Truck className="w-5 h-5 text-blue-600" />
        </div>
        <span className="text-xs text-center font-medium text-blue-700 dark:text-blue-300">Instant Delivery</span>
      </div>
      <div className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-2xl border border-purple-200 dark:border-purple-800">
        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-purple-600" />
        </div>
        <span className="text-xs text-center font-medium text-purple-700 dark:text-purple-300">24/7 Support</span>
      </div>
    </motion.div>
  );
};

export default ProductFeatures;
