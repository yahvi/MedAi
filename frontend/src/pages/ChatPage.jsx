import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Send,
  ShieldAlert,
  Square,
  Trash2,
  User,
  Volume2,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  startListening,
  stopSpeaking,
} from '../services/speech';

function RenderFormattedText({ text }) {
  // Lightweight bold/newline renderer without dangerous HTML injection
  const lines = (text || '').split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**') ? (
                <strong key={j} className="font-semibold">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                <span key={j}>{part}</span>
              )
            )}
          </p>
        );
      })}
    </div>
  );
}

export default function ChatPage({
  reports,
  sessions,
  initialReportId,
  initialSessionId,
  initialPrompt,
  onConsumeInitialPrompt,
  onRefreshData,
}) {
  const { language, prefs, t } = useSettings();
  const [activeSessionId, setActiveSessionId] = useState(initialSessionId || null);
  const [attachedReportId, setAttachedReportId] = useState(initialReportId || '');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [error, setError] = useState('');

  const recognitionRef = useRef(null);
  const bottomRef = useRef(null);
  const skipNextFetchRef = useRef(false);

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      onConsumeInitialPrompt?.();
    }
  }, [initialPrompt, onConsumeInitialPrompt]);

  useEffect(() => {
    if (initialSessionId) {
      setActiveSessionId(initialSessionId);
    }
  }, [initialSessionId]);

  useEffect(() => {
    if (initialReportId) {
      setAttachedReportId(initialReportId);
      setActiveSessionId(null);
      setMessages([]);
    }
  }, [initialReportId]);

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    api
      .getChatSession(activeSessionId)
      .then((res) => {
        setMessages(res.messages || []);
        setAttachedReportId(res.session?.report_id || '');
      })
      .catch(() => {});
  }, [activeSessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      recognitionRef.current?.stop();
    };
  }, []);

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setError('');
  };

  const handleDeleteSession = async (id, e) => {
    e.stopPropagation();
    await api.deleteChatSession(id);
    if (activeSessionId === id) {
      handleNewChat();
    }
    await onRefreshData();
  };

  const sendMessageText = async (rawText) => {
    const text = (rawText || '').trim();
    if (!text || sending) return;
    setError('');
    setSending(true);
    setInput('');

    const tempId = `temp-${Date.now()}`;
    try {
      let sid = activeSessionId;
      if (!sid) {
        const created = await api.createChatSession({
          title: text.slice(0, 46),
          report_id: attachedReportId || null,
        });
        sid = created.session.id;
        skipNextFetchRef.current = true;
        setActiveSessionId(sid);
      }

      // Optimistic user bubble
      setMessages((prev) => [
        ...prev,
        { id: tempId, role: 'user', content: text, language },
      ]);

      const res = await api.sendChatMessage(sid, {
        message: text,
        language,
        report_id: attachedReportId || '',
      });

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        res.user_message,
        res.assistant_message,
      ]);

      if (prefs.voice_auto_read && res.assistant_message?.content) {
        setSpeakingMsgId(res.assistant_message.id);
        speakText(res.assistant_message.content, language, () => setSpeakingMsgId(null));
      }

      await onRefreshData();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
      setError(err.message || 'Could not reach Dr. Sehat.');
    } finally {
      setSending(false);
    }
  };

  const toggleVoiceInput = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    setError('');
    setListening(true);
    recognitionRef.current = startListening({
      language,
      onResult: (transcript) => {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      },
      onError: (errMsg) => {
        setError(String(errMsg));
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
  };

  const toggleSpeakMsg = (msg) => {
    if (speakingMsgId === msg.id) {
      stopSpeaking();
      setSpeakingMsgId(null);
      return;
    }
    setSpeakingMsgId(msg.id);
    speakText(msg.content, msg.language || language, () => setSpeakingMsgId(null));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t.chat.title}</h1>
          <p className="text-sm text-slate-600 mt-0.5">{t.chat.subtitle}</p>
        </div>
        <button
          onClick={handleNewChat}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          {t.chat.newChat}
        </button>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-4 items-start">
        {/* Sessions List */}
        <aside className="med-card bg-white rounded-2xl border border-slate-200 p-3 space-y-2 max-h-[68vh] overflow-y-auto">
          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t.history.chatsTab}
          </div>
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-500 px-2 py-4">{t.history.emptyChats}</p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-colors ${
                  activeSessionId === s.id
                    ? 'bg-teal-50 text-teal-900 font-semibold border border-teal-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{s.title}</span>
                <button
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  className="opacity-60 group-hover:opacity-100 p-1 rounded hover:bg-rose-100 hover:text-rose-700 cursor-pointer"
                  title={t.history.delete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </aside>

        {/* Chat Area */}
        <section className="med-card bg-white rounded-2xl border border-slate-200 flex flex-col h-[70vh] min-h-[500px] overflow-hidden shadow-xs">
          {/* Attached Report Context Bar */}
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <FileText className="h-4 w-4 text-teal-700" />
              <span>{t.chat.attachedReport}:</span>
            </div>
            <select
              value={attachedReportId}
              onChange={(e) => setAttachedReportId(e.target.value)}
              className="flex-1 min-w-[200px] max-w-md rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">{t.chat.noReportContext}</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.report_date || new Date(r.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Bot className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">
                    {language === 'hi' ? 'नमस्ते! मैं डॉ. सेहत हूँ।' : 'Hello! I am Dr. Sehat.'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">{t.chat.safetyNote}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 w-full">
                  {t.chat.starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessageText(prompt)}
                      className="text-left text-xs p-3 rounded-xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 text-slate-700 transition-colors cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="h-8 w-8 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                        isUser
                          ? 'bg-teal-700 text-white rounded-tr-sm'
                          : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-sm'
                      }`}
                    >
                      <RenderFormattedText text={msg.content} />
                      {!isUser && isSpeechSynthesisSupported() && (
                        <div className="mt-2 pt-2 border-t border-slate-200/70 flex justify-end">
                          <button
                            onClick={() => toggleSpeakMsg(msg)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
                          >
                            {speakingMsgId === msg.id ? (
                              <>
                                <Square className="h-3 w-3" />
                                {t.reports.stopListening}
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-3 w-3" />
                                {t.chat.readAloud}
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    {isUser && (
                      <div className="h-8 w-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {sending && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-teal-700 text-white flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-700" />
                  <span>{language === 'hi' ? 'डॉ. सेहत सोच रहे हैं...' : 'Dr. Sehat is replying...'}</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 sm:p-4 border-t border-slate-200 bg-white space-y-2">
            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
            {listening && (
              <p className="text-xs text-teal-700 font-semibold animate-pulse">
                {t.chat.listening}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessageText(input);
              }}
              className="flex items-center gap-2"
            >
              {isSpeechRecognitionSupported() && (
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  title={t.chat.voiceInput}
                  className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                    listening
                      ? 'bg-rose-100 border-rose-300 text-rose-700'
                      : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-teal-50 hover:text-teal-800'
                  }`}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.chat.placeholder}
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{t.chat.send}</span>
              </button>
            </form>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>{t.chat.safetyNote}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

