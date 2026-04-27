import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIChat } from './ai-chat/useAIChat';
import { FloatingButton } from './ai-chat/FloatingButton';
import { ChatHeader } from './ai-chat/ChatHeader';
import { ChatMessagesArea } from './ai-chat/ChatMessagesArea';
import { ChatInputArea } from './ai-chat/ChatInputArea';

const AIChatWidget: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const chat = useAIChat();
  const [open, setOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const [btnPos, setBtnPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasMoved = useRef(false);

  useEffect(() => { chat.scrollToBottom(); }, [chat.messages, open, chat.scrollToBottom]);

  useEffect(() => {
    if (chat.inputRef.current) {
      chat.inputRef.current.style.height = 'auto';
      chat.inputRef.current.style.height = Math.min(chat.inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [chat.input]);

  useEffect(() => {
    if (open && chat.inputRef.current && !chat.searchMode) setTimeout(() => chat.inputRef.current?.focus(), 300);
  }, [open, chat.searchMode]);

  useEffect(() => {
    if (chat.searchMode && chat.searchInputRef.current) chat.searchInputRef.current.focus();
  }, [chat.searchMode]);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && open) {
        e.preventDefault();
        chat.setSearchMode((prev: boolean) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [open]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    hasMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, posX: btnPos.x, posY: btnPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [btnPos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;
    setBtnPos({ x: dragStart.current.posX + dx, y: dragStart.current.posY + dy });
  }, []);

  const handlePointerUp = useCallback(() => { isDragging.current = false; }, []);
  const handleBtnClick = useCallback(() => { if (!hasMoved.current) setOpen(true); }, []);

  const msgCount = chat.messages.length;

  const panelClasses = isFullScreen
    ? 'fixed inset-0 z-[60] w-full h-full rounded-none'
    : 'fixed bottom-24 right-4 z-[60] w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] rounded-2xl';

  return (
    <>
      <AnimatePresence>
        {!open && !isHidden && location.pathname !== '/ai' && (
          <FloatingButton
            btnPos={btnPos}
            msgCount={msgCount}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={handleBtnClick}
            onHide={() => setIsHidden(true)}
          />
        )}
      </AnimatePresence>

      <input
        ref={chat.fileInputRef}
        type="file"
        accept="image/*"
        onChange={chat.handleImageSelect}
        className="hidden"
      />

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`${panelClasses} bg-background border border-border/60 shadow-2xl flex flex-col overflow-hidden`}
          >
            <ChatHeader
              isFullScreen={isFullScreen}
              loading={chat.loading}
              userId={chat.userId}
              msgCount={msgCount}
              totalWords={chat.totalWords}
              onSearchToggle={() => { chat.setSearchMode((prev: boolean) => !prev); chat.setSearchTerm(''); }}
              onClear={chat.handleClearChat}
              onExpand={() => { setOpen(false); navigate('/ai'); }}
              onClose={() => { setOpen(false); chat.setSearchMode(false); }}
            />

            <ChatMessagesArea chat={chat} onClose={() => setOpen(false)} />

            <ChatInputArea chat={chat} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatWidget;
