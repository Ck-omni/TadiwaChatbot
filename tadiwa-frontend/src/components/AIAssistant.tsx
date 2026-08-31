import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';
import { useAuth } from '../context/AuthContext';
import { assistantApi, ApiError, type AssistantSource } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  // assistant messages only — the KB procedures the answer actually drew on.
  sources?: AssistantSource[];
}

const STREAM_STATUS_LABEL: Record<string, string> = {
  retrieving: 'Searching the knowledge base…',
  context: 'Reviewing matching procedures…',
  generating: 'Thinking…',
};

export default function AIAssistant() {
  const { accessToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm TADIWA, your Omni HD Assistant. How can I help you with a technical resolution today?" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  // Progress label shown in the streaming placeholder bubble before the
  // first answer token arrives — null once real text starts rendering.
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Don't leave a request (and the local model grinding on it) running
  // against a chat the technician has navigated away from.
  useEffect(() => () => abortRef.current?.abort(), []);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !accessToken) return;

    const userMessage = input.trim();
    // The backend re-embeds and re-retrieves off `message` each turn — send
    // only the on-screen thread as history, not this new message.
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setInput('');
    setIsLoading(true);
    setStreamStatus(STREAM_STATUS_LABEL.retrieving);

    const controller = new AbortController();
    abortRef.current = controller;

    // Placeholder the answer streams into; index is fixed by this initial
    // append (both this and history above happen before any state update
    // schedule, so the assistant reply always lands right after the user's).
    let assistantIndex = -1;
    setMessages(prev => {
      assistantIndex = prev.length + 1;
      return [...prev, { role: 'user', content: userMessage }, { role: 'assistant', content: '' }];
    });

    const appendToAnswer = (delta: string) => {
      setMessages(prev => prev.map((m, i) => (i === assistantIndex ? { ...m, content: m.content + delta } : m)));
    };
    const setAnswerContent = (content: string) => {
      setMessages(prev => prev.map((m, i) => (i === assistantIndex ? { ...m, content } : m)));
    };
    const setAnswerSources = (sources: AssistantSource[]) => {
      setMessages(prev => prev.map((m, i) => (i === assistantIndex ? { ...m, sources } : m)));
    };

    try {
      for await (const ev of assistantApi.askStream(accessToken, userMessage, history, controller.signal)) {
        if (ev.stage === 'token' && ev.content) {
          setStreamStatus(null);
          appendToAnswer(ev.content);
        } else if (ev.stage === 'done') {
          if (ev.sources) setAnswerSources(ev.sources);
        } else if (ev.stage === 'error') {
          setStreamStatus(null);
          setAnswerContent(ev.detail || "Sorry, I'm having trouble connecting to the network. Please check your session.");
        } else {
          setStreamStatus(STREAM_STATUS_LABEL[ev.stage] || null);
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return; // navigated away — not a real error
      console.error("AI Assistant Error:", error);
      const message = error instanceof ApiError ? error.message : "Sorry, I'm having trouble connecting to the network. Please check your session.";
      setAnswerContent(message);
    } finally {
      setIsLoading(false);
      setStreamStatus(null);
      abortRef.current = null;
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-2xl hover:bg-blue-500 transition-all flex items-center justify-center group z-50 animate-in fade-in zoom-in"
      >
        <MessageSquare className="group-hover:scale-110 transition-transform" />
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 w-96 bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col transition-all duration-300 z-50 overflow-hidden",
        isMinimized ? "h-16" : "h-[600px] max-h-[80vh]"
      )}
    >
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-xl">
            <Bot size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">TADIWA</h3>
            <p className="text-[10px] text-emerald-600 uppercase tracking-widest font-bold">AI Active</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-slate-100 rounded-md transition-colors"
          >
            {isMinimized ? <Maximize2 size={16} className="text-slate-400" /> : <Minimize2 size={16} className="text-slate-400" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-400"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-slate-50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex flex-col animate-in fade-in slide-in-from-bottom-2",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {msg.role === 'assistant' ? 'TADIWA' : 'Technician'}
                  </span>
                </div>
                <div className={cn(
                  "max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed",
                  msg.role === 'user'
                    ? "bg-blue-600 text-white rounded-tr-none"
                    : "bg-white text-slate-700 border border-slate-200 rounded-tl-none"
                )}>
                  {msg.role === 'assistant' && msg.content === '' && isLoading && idx === messages.length - 1 ? (
                    // This is the in-flight answer's placeholder bubble —
                    // no tokens yet. Runs against a local model (can take up
                    // to ~90s), so say what's happening rather than leaving
                    // a bare spinner that reads as hung.
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                      <span className="text-[10px] text-slate-400">{streamStatus || 'Working…'}</span>
                    </div>
                  ) : msg.role === 'assistant' ? (
                    <div className="prose prose-slate prose-xs max-w-none">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  ) : msg.content}
                  {!!msg.sources?.length && (
                    <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                      {msg.sources.map((s, i) => (
                        <span
                          key={i}
                          title={`${Math.round(s.similarity * 100)}% match`}
                          className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-1.5 py-0.5"
                        >
                          {[s.topic, s.section].filter(Boolean).join(' › ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-2 border border-slate-200 focus-within:border-blue-400 transition-all">
              <input
                type="text"
                placeholder="Ask about SOPs, resolutions..."
                className="flex-1 bg-transparent border-none focus:outline-none text-xs text-slate-900 px-2 placeholder:text-slate-400"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button
                onClick={handleSend}
                disabled={isLoading}
                className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
