"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart2,
  Plus,
  Search,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { logout } from '@/backend/auth/actions';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
}

const SAMPLE_CHATS: Chat[] = [
  { id: '1', title: 'Phân tích xu hướng tuyển dụng IT', messages: [] },
  { id: '2', title: 'Tư vấn lộ trình nghề nghiệp', messages: [] },
  { id: '3', title: 'So sánh mức lương ngành Data', messages: [] },
  { id: '4', title: 'Kỹ năng cần thiết cho Product Manager', messages: [] },
  { id: '5', title: 'Top công ty công nghệ tại Hà Nội', messages: [] },
];

export default function AIAssistantPage({ user }: { user?: any }) {
  const [chats, setChats] = useState<Chat[]>(SAMPLE_CHATS);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);

  const filteredChats = chats.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInputValue('');
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    const chat = chats.find(c => c.id === chatId);
    setMessages(chat?.messages || []);
  };

  const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMessages([]);
    }
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);

    // Create or update chat
    let currentChatId = activeChatId;
    if (!currentChatId) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: text.length > 40 ? text.slice(0, 40) + '...' : text,
        messages: [],
      };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(newChat.id);
      currentChatId = newChat.id;
    }

    // Simulate AI response
    setTimeout(() => {
      const aiResponses: Record<string, string> = {
        default: `Tôi hiểu bạn đang hỏi về "${text}". Đây là một chủ đề thú vị trong thị trường việc làm hiện nay. Hãy để tôi phân tích và đưa ra những thông tin hữu ích nhất cho bạn dựa trên dữ liệu thị trường mới nhất từ CareerIntel.`,
      };

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponses.default,
      };

      const updatedMessages = [...newMessages, aiMsg];
      setMessages(updatedMessages);
      setChats(prev => prev.map(c =>
        c.id === currentChatId ? { ...c, messages: updatedMessages } : c
      ));
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    'Xu hướng tuyển dụng IT 2025?',
    'Mức lương trung bình Data Engineer?',
    'Kỹ năng hot nhất hiện nay?',
    'Tư vấn CV cho fresher?',
  ];

  return (
    <div className="flex flex-col h-screen bg-[#f4f2ee]">
      {/* --- NAVBAR --- */}
      <nav className="flex justify-between items-center px-6 md:px-12 py-4 bg-white z-20 relative shadow-sm shrink-0">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white">
            <BarChart2 size={24} className="text-blue-400" />
          </div>
          <span className="font-bold text-2xl text-slate-800">
            Career<span className="text-blue-600">Intel</span>
            <span className="block text-[10px] text-gray-500 font-normal -mt-1">Intelligent Job Market Hub</span>
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-8 font-semibold text-sm text-slate-800">
          <Link href="/search" className="hover:text-blue-600 transition">Job Search</Link>
          <Link href="/insights" className="hover:text-blue-600 transition">Market Insights</Link>
          <Link href="/ai" className="text-blue-600 border-b-2 border-blue-600 pb-1">AI Assistant</Link>
          <Link href="/profile" className="hover:text-blue-600 transition">My Profile</Link>
        </div>

        <div className="hidden lg:flex items-center gap-4 font-semibold text-sm text-slate-800">
          {user ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span>Hi, {user.user_metadata?.full_name || 'User'}</span>
              </div>
              <button onClick={() => logout()} className="bg-gray-100 hover:bg-gray-200 text-slate-800 px-6 py-2.5 rounded-md font-medium transition shadow-sm cursor-pointer">
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link href="/signup">
                <button className="bg-[#f27a42] hover:bg-[#e06830] text-white px-6 py-2.5 rounded-md font-medium transition shadow-md">Sign Up</button>
              </Link>
              <Link href="/login">
                <button className="bg-gray-100 hover:bg-gray-200 text-slate-800 px-6 py-2.5 rounded-md font-medium transition shadow-sm">Log In</button>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* --- BODY: SIDEBAR + CHAT AREA --- */}
      <div className="flex flex-1 overflow-hidden">

        {/* SIDEBAR */}
        <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          {/* New Chat + Search */}
          <div className="p-3 flex flex-col gap-2 border-b border-gray-100">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-slate-700 font-semibold text-sm hover:bg-[#f4f2ee] transition-colors"
            >
              <Plus size={18} className="text-blue-600" />
              New chat
            </button>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f4f2ee] text-gray-500">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search chats"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-sm w-full text-slate-700 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto py-2">
            {filteredChats.length > 0 ? (
              <>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2">Recents</p>
                {filteredChats.map(chat => (
                  <div
                    key={chat.id}
                    onClick={() => handleSelectChat(chat.id)}
                    className={`group flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer rounded-lg mx-2 transition-colors ${
                      activeChatId === chat.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-[#f4f2ee] text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare size={15} className="shrink-0 text-gray-400" />
                      <span className="text-sm truncate">{chat.title}</span>
                    </div>
                    <button
                      onClick={e => handleDeleteChat(e, chat.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center mt-8 px-4">No chat history found.</p>
            )}
          </div>
        </aside>

        {/* MAIN CHAT AREA */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#f4f2ee]">
          {messages.length === 0 ? (
            /* Welcome Screen */
            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 bg-white rounded-2xl shadow-md flex items-center justify-center border border-gray-100">
                  <Sparkles size={28} className="text-blue-500" />
                </div>
                <h1 className="text-3xl font-bold text-slate-800">Where should we begin?</h1>
                <p className="text-gray-500 text-sm max-w-md">Ask me anything about the job market, recruitment trends, or career advice.</p>
              </div>

              {/* Suggestion chips */}
              <div className="grid grid-cols-2 gap-3 max-w-xl w-full">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInputValue(s); }}
                    className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all text-left shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Input at center */}
              <div className="w-full max-w-2xl">
                <ChatInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={handleSend}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>
          ) : (
            /* Active Chat */
            <>
              <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4 max-w-3xl mx-auto w-full">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
                        <Sparkles size={16} className="text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-white text-slate-800 border border-gray-200 rounded-bl-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
                      <Sparkles size={16} className="text-white" />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                      <div className="flex gap-1.5 items-center h-5">
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input at bottom */}
              <div className="px-6 pb-6 max-w-3xl mx-auto w-full">
                <ChatInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={handleSend}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ChatInput({
  value,
  onChange,
  onSend,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
      <Plus size={18} className="text-gray-400 shrink-0" />
      <textarea
        rows={1}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask anything"
        className="flex-1 bg-transparent outline-none resize-none text-sm text-slate-800 placeholder-gray-400 leading-6 max-h-40 overflow-y-auto"
      />
      <button
        onClick={onSend}
        disabled={!value.trim()}
        className="w-8 h-8 rounded-full bg-blue-600 disabled:bg-gray-200 flex items-center justify-center transition-colors hover:bg-blue-700 shrink-0"
      >
        <Send size={14} className={value.trim() ? 'text-white' : 'text-gray-400'} />
      </button>
    </div>
  );
}
