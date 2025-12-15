import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { geminiService } from '../services/geminiService';
import { InvoiceRow, ChatMessage } from '../types';

interface AiAssistantProps {
  data: InvoiceRow[];
}

const AiAssistant: React.FC<AiAssistantProps> = ({ data }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello! I have analyzed the uploaded B2B invoice data. Ask me anything about suppliers, tax amounts, or invoice details.' }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsThinking(true);

    try {
      const response = await geminiService.analyzeData(data, userMessage);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error while processing your request.', isError: true }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-xl">
        <div className="flex items-center space-x-2 text-white">
          <Sparkles className="w-5 h-5" />
          <h2 className="font-semibold text-lg">AI Financial Analyst</h2>
        </div>
        <p className="text-blue-100 text-xs mt-1">Powered by Gemini 2.5 Flash</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start space-x-3 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-600'
            }`}>
              {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
            </div>
            
            <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : msg.isError 
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-none'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
              }`}>
                {msg.role === 'user' ? (
                  msg.text
                ) : (
                  <ReactMarkdown 
                    className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1"
                    components={{
                       // Basic styling overrides for better fit in chat bubble
                       p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />,
                       a: ({node, ...props}) => <a className="text-blue-500 hover:underline" {...props} />
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isThinking && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-200 rounded-b-xl">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="E.g., Which supplier has the highest taxable value?"
            className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-gray-400 text-sm"
            disabled={isThinking}
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AiAssistant;
