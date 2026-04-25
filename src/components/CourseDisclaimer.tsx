import { AlertTriangle } from 'lucide-react';

const CourseDisclaimer = () => {
  return (
    <div className="rounded-xl border border-amber-300/60 dark:border-amber-700/40 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 p-3 flex items-start gap-2.5 shadow-sm">
      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
        <span className="font-semibold">Notice to Course Owners:</span> All courses listed here are shared for educational purposes only. If you are the original owner and have any concerns or wish to request removal, please{' '}
        <a href="/chat" className="underline font-semibold hover:text-amber-700 dark:hover:text-amber-300">contact our support team</a>
        {' '}— we will remove the content immediately upon verified request.
      </p>
    </div>
  );
};

export default CourseDisclaimer;
