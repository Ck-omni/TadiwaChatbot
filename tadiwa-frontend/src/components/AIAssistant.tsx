import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `You are TADIWA, a highly specialized AI assistant for technical support technicians at Econet Zimbabwe.
Your goal is to provide fast, accurate resolution steps based on the official knowledge base. Your name is TADIWA.

CORE KNOWLEDGE BASE:

1. SIM Card Replacement:
- Authenticate on Back-Office Portal → Enter CCID → Process in Individual Portal.
- Steps: Switch to Back-Office portal, Authenticate SIM card, Order Entry → Operations → SIM Replacement, Enter ICCID and Ticket ID.

2. Line Reconnection:
- Recycle disabled SIMs and bind to active service numbers.
- Steps: Check SIM Lifecycle for 'disabled' state, Recycle if disabled, escalate if available, Perform SIM Card Binding, PPS First Dial in Operations.

3. Hanging Orders:
- Check Abnormal Work Orders and redo provisioning actions.
- Steps: Provisioning → Dispatch Order Query, Copy Dispatch ID → Online Work Order Query, Check Abnormal Work Order tab, Authenticate HLR/HGIRI/Check In as needed.

4. Roaming / USSD Fixes:
- Verify HLR parameters and OBSSM restrictions.
- Steps: Check cvBS and RSA 2-6 variants (Roaming), SUD command to remove OBSSM (USSD), Reset VLR/SGSN if restricted, Manual network selection advice.

5. Adding GPRS/Telephony (Quick Action):
- 1. Order Entry → Modify Offer
- 2. Add Button → Search Service
- 3. Waiver 100% (for bundles)

6. Balance Adjustments & D.A (Quick Action):
- 1. Account Receivable → Adjust
- 2. Add Account Balance for new D.A
- 3. Select Unit of Measurement

7. Block/Suspension (Quick Action):
- 1. Operations → Suspension/LOST
- 2. Reactivation → Restore
- 3. Enter Ticket ID → Confirm

Always be professional, concise, and focused on SOP compliance. Use formatting to make steps clear.`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm TADIWA, your Omni HD Assistant. How can I help you with a technical resolution today?" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          })),
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          maxOutputTokens: 500,
        }
      });

      const assistantMessage = response.text || "I'm sorry, I couldn't generate a response. Please try again.";
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (error) {
      console.error("AI Assistant Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting to the network. Please check your session." }]);
    } finally {
      setIsLoading(false);
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
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-slate prose-xs max-w-none">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  ) : msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                </div>
              </div>
            )}
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
