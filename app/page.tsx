"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, Settings, Download, Trash2 } from "lucide-react";
import axios from "axios";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface ModelConfig {
  provider: "ollama" | "lmstudio";
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  systemPrompt: string;
  streamResponse: boolean;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const [config, setConfig] = useState<ModelConfig>({
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "llama2",
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
    topK: 40,
    repeatPenalty: 1.1,
    systemPrompt: "You are a helpful AI assistant with access to local system capabilities. You can help search files, answer questions, and assist with tasks.",
    streamResponse: true,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchModels();
  }, [config.provider, config.baseUrl]);

  useEffect(() => {
    // Initialize speech recognition
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join("");

        setInput(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchModels = async () => {
    try {
      if (config.provider === "ollama") {
        const response = await axios.get(`${config.baseUrl}/api/tags`);
        setAvailableModels(response.data.models?.map((m: any) => m.name) || []);
      } else if (config.provider === "lmstudio") {
        const response = await axios.get(`${config.baseUrl}/v1/models`);
        setAvailableModels(response.data.data?.map((m: any) => m.id) || []);
      }
    } catch (error) {
      console.error("Error fetching models:", error);
      setAvailableModels([]);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      let responseText = "";

      if (config.provider === "ollama") {
        const response = await axios.post(
          `${config.baseUrl}/api/generate`,
          {
            model: config.model,
            prompt: input.trim(),
            system: config.systemPrompt,
            options: {
              temperature: config.temperature,
              num_predict: config.maxTokens,
              top_p: config.topP,
              top_k: config.topK,
              repeat_penalty: config.repeatPenalty,
            },
            stream: false,
          }
        );
        responseText = response.data.response;
      } else if (config.provider === "lmstudio") {
        const response = await axios.post(
          `${config.baseUrl}/v1/chat/completions`,
          {
            model: config.model,
            messages: [
              { role: "system", content: config.systemPrompt },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
              { role: "user", content: input.trim() },
            ],
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            top_p: config.topP,
            stream: false,
          }
        );
        responseText = response.data.choices[0].message.content;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Speak the response
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(responseText);
        window.speechSynthesis.speak(utterance);
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "system",
        content: `Error: ${error.response?.data?.error || error.message || "Failed to connect to AI model"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const exportChat = () => {
    const chatText = messages
      .map((m) => `[${m.timestamp.toLocaleString()}] ${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const blob = new Blob([chatText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Settings Panel */}
      <div
        className={`${
          showSettings ? "w-96" : "w-0"
        } transition-all duration-300 overflow-hidden bg-gray-900 border-r border-gray-800`}
      >
        <div className="p-6 h-full overflow-y-auto">
          <h2 className="text-2xl font-bold mb-6">Settings</h2>

          <div className="space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Provider</label>
              <select
                value={config.provider}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    provider: e.target.value as "ollama" | "lmstudio",
                    baseUrl: e.target.value === "ollama" ? "http://localhost:11434" : "http://localhost:1234",
                  })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
              >
                <option value="ollama">Ollama</option>
                <option value="lmstudio">LM Studio</option>
              </select>
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-sm font-medium mb-2">Base URL</label>
              <input
                type="text"
                value={config.baseUrl}
                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                placeholder="http://localhost:11434"
              />
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Model</label>
              <select
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
              >
                {availableModels.length > 0 ? (
                  availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                ) : (
                  <option value={config.model}>{config.model}</option>
                )}
              </select>
              <button
                onClick={fetchModels}
                className="mt-2 text-sm text-blue-400 hover:text-blue-300"
              >
                Refresh Models
              </button>
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Temperature: {config.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Max Tokens */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Max Tokens: {config.maxTokens}
              </label>
              <input
                type="range"
                min="256"
                max="8192"
                step="256"
                value={config.maxTokens}
                onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Top P */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Top P: {config.topP}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.topP}
                onChange={(e) => setConfig({ ...config, topP: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Top K */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Top K: {config.topK}
              </label>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={config.topK}
                onChange={(e) => setConfig({ ...config, topK: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Repeat Penalty */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Repeat Penalty: {config.repeatPenalty}
              </label>
              <input
                type="range"
                min="1"
                max="2"
                step="0.05"
                value={config.repeatPenalty}
                onChange={(e) => setConfig({ ...config, repeatPenalty: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-sm font-medium mb-2">System Prompt</label>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 h-32"
                placeholder="System prompt..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Local AI Chat</h1>
            <p className="text-sm text-gray-400">
              {config.provider === "ollama" ? "Ollama" : "LM Studio"} • {config.model}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportChat}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Export Chat"
              disabled={messages.length === 0}
            >
              <Download size={20} />
            </button>
            <button
              onClick={clearChat}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Clear Chat"
              disabled={messages.length === 0}
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 hover:bg-gray-800 rounded-lg transition-colors ${
                showSettings ? "bg-gray-800" : ""
              }`}
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto chat-scroll px-6 py-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-2">Welcome to Local AI Chat</h2>
                <p>Start chatting or use voice input to interact with your local AI model</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-6 py-3 ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : message.role === "system"
                        ? "bg-red-900/50 text-red-200 border border-red-800"
                        : "bg-gray-800 text-gray-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p className="text-xs mt-2 opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-gray-900 border-t border-gray-800 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-end gap-3">
            <button
              onClick={toggleRecording}
              className={`p-3 rounded-lg transition-colors ${
                isRecording
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gray-800 hover:bg-gray-700"
              }`}
              title={isRecording ? "Stop Recording" : "Start Recording"}
            >
              {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your message... (Shift+Enter for new line)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 resize-none focus:outline-none focus:border-blue-500"
              rows={3}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
              title="Send Message"
            >
              <Send size={24} />
            </button>
          </div>
          {isLoading && (
            <div className="max-w-4xl mx-auto mt-3 text-center text-sm text-gray-400">
              <span className="inline-block animate-pulse">AI is thinking...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
