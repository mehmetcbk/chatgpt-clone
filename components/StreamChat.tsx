// components/StreamChat.tsx
"use client";

import { useState, useEffect, useRef } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

export default function StreamChat() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");

  // Load past chats
  useEffect(() => {
    fetch("/api/stream/chat")
      .then((res) => res.json())
      .then(setChats);
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copiedCodeId) {
      const timer = setTimeout(() => {
        setCopiedCodeId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedCodeId]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
  
    const userMessage = { role: "user" as const, content: input };
    // Optimistically update UI
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreamingContent(""); // Clear at the beginning
  
    try {
      if (currentChatId) {
        // Continue existing chat
        const res = await fetch(`/api/stream/chat/${currentChatId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: input }),
        });
  
        if (!res.ok) {
          throw new Error('Failed to send message');
        }
  
        // Process the streaming response
        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error('Response body is null');
        }
  
        // Add a placeholder message for the streaming response
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
  
        let collectedContent = ""; // Use local variable instead of state for collecting
  
        // Read the stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const text = new TextDecoder().decode(value);
          collectedContent += text; // Update local variable
          setStreamingContent(collectedContent); // Update state for display
        }
  
        // Important: Store final content before any resets
        const finalContent = collectedContent;
        
        // Update the messages after streaming is complete
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: "assistant",
            content: finalContent, // Use local captured content
          };
          return newMessages;
        });
  
        // Update chat in state
        setChats((prevChats) =>
          prevChats.map((chat) => {
            if (chat.id === currentChatId) {
              const currentMessages = [...messages, userMessage];
              return {
                ...chat,
                messages: [
                  ...currentMessages.slice(0, currentMessages.length - 1),
                  { role: "assistant", content: finalContent }
                ]
              };
            }
            return chat;
          })
        );
      } else {
        const res = await fetch("/api/stream/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [userMessage] }),
        });
  
        if (!res.ok) {
          throw new Error('Failed to create new chat');
        }
  
        // Get the chat ID from the response headers
        const chatId = res.headers.get('X-Chat-ID');
        setCurrentChatId(chatId);
  
        // Add a placeholder message for the streaming response
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
  
        let collectedContent = ""; // Local variable for collection
  
        // Process the streaming response
        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error('Response body is null');
        }
  
        // Read the stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const text = new TextDecoder().decode(value);
          collectedContent += text; // Update local variable
          setStreamingContent(collectedContent); // Update state for display
        }
  
        // Capture final content
        const finalContent = collectedContent;
        
        // Update messages after streaming completes
        const finalMessages = [
          userMessage,
          { role: "assistant", content: finalContent }
        ];
        
        setMessages(finalMessages as Message[]);
        
        // Add the new chat to state
        if (chatId) {
          // Default title from the first message
          const defaultTitle = userMessage.content.split(' ').slice(0, 4).join(' ') + 
                             (userMessage.content.length > 20 ? '...' : '');
          
          // Add the new chat to the list
          setChats((prev) => [{
            id: chatId,
            title: defaultTitle,
            messages: finalMessages,
            createdAt: new Date().toISOString()
          }, ...prev] as Chat[]);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove optimistic update if there's an error
      setMessages((prev) => prev.filter((msg) => msg !== userMessage));
    } finally {
      setLoading(false);
      // Clear streaming content AFTER all state updates
      setTimeout(() => setStreamingContent(""), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setStreamingContent("");
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return "";
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
  };

  const startEditingTitle = (chatId: string, currentTitle: string) => {
    setEditingTitle(chatId);
    setNewTitle(currentTitle);
  };

  const updateChatTitle = async (chatId: string) => {
    if (!newTitle.trim()) {
      setEditingTitle(null);
      return;
    }

    try {
      const res = await fetch(`/api/stream/chat/${chatId}/title`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });

      if (res.ok) {
        // Update local state
        setChats((prevChats) =>
          prevChats.map((chat) => (chat.id === chatId ? { ...chat, title: newTitle } : chat))
        );
      }
    } catch (error) {
      console.error("Error updating title:", error);
    } finally {
      setEditingTitle(null);
    }
  };

  const deleteChat = async (chatId: string) => {
    if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
      const res = await fetch(`/api/stream/chat/${chatId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Update local state
        setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));

        // If the deleted chat was selected, clear selection
        if (currentChatId === chatId) {
          setCurrentChatId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  const getCurrentChat = () => {
    return chats.find(chat => chat.id === currentChatId);
  };

  // Function to handle copying code to clipboard
  const handleCopyCode = (codeText: string, codeId: string) => {
    navigator.clipboard.writeText(codeText)
      .then(() => {
        setCopiedCodeId(codeId);
      })
      .catch(err => {
        console.error('Could not copy text: ', err);
      });
  };

  // Format message content - fixed with proper code block handling
  const formatMessageContent = (content: string): React.ReactNode => {
    if (!content) return null;

    // Regex to capture code blocks: ```[language]\n code \n```
    const codeBlockRegex = /```([a-z]*)\n([\s\S]*?)```/g;
    const parts: Array<{ type: 'text' | 'code'; content?: string; language?: string; code?: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Split content into text and code parts
    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', language: match[1], code: match[2] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.slice(lastIndex) });
    }

    // Process text parts with other markdown replacements
    const processText = (text: string): string => {
      let formattedText = text;

      // Process tables
      const tableRegex = /\|(.+)\|\n\|(\s*[-:]+[-:|\s]*)\|\n((?:\|.*\|\n?)+)/g;
      formattedText = formattedText.replace(tableRegex, (_, headerRow, separatorRow, bodyRows) => {
        const headers = headerRow.split("|").map((cell: string) => cell.trim());
        const rows = bodyRows
          .trim()
          .split("\n")
          .map((row: string) => row.split("|").map((cell: string) => cell.trim()).filter(Boolean));
        let tableHtml = `<div class="overflow-x-auto my-4"><table class="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">`;
        tableHtml += `<thead class="bg-gray-50"><tr>`;
        headers.filter(Boolean).forEach((header: any) => {
          tableHtml += `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${header}</th>`;
        });
        tableHtml += `</tr></thead>`;
        tableHtml += `<tbody class="bg-white divide-y divide-gray-200">`;
        rows.forEach((row: any[], rowIndex: number) => {
          tableHtml += `<tr class="${rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}">`;
          row.forEach((cell: any) => {
            tableHtml += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${cell}</td>`;
          });
          tableHtml += `</tr>`;
        });
        tableHtml += `</tbody></table></div>`;
        return tableHtml;
      });

      // Process inline code
      formattedText = formattedText.replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-800 px-1 py-0.5 rounded font-mono text-sm">$1</code>');
      // Process bold text
      formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      // Process italic text
      formattedText = formattedText.replace(/\*([^*]+)\*/g, "<em>$1</em>");
      // Process links
      formattedText = formattedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
      // Process bullet points and numbered lists
      formattedText = formattedText.replace(/^- (.+)$/gm, "<li class='ml-4'>$1</li>");
      formattedText = formattedText.replace(/^\d+\. (.+)$/gm, "<li class='ml-6 list-decimal'>$1</li>");
      // Process headings (h1 to h3)
      formattedText = formattedText.replace(/^### (.+)$/gm, "<h3 class='text-lg font-semibold mt-4 mb-2'>$1</h3>");
      formattedText = formattedText.replace(/^## (.+)$/gm, "<h2 class='text-xl font-semibold mt-5 mb-2'>$1</h2>");
      formattedText = formattedText.replace(/^# (.+)$/gm, "<h1 class='text-2xl font-bold mt-6 mb-3'>$1</h1>");
      // Wrap paragraphs
      formattedText = "<p>" + formattedText.replace(/\n\n/g, "</p><p>") + "</p>";
      // Fix nested paragraph tags in lists
      formattedText = formattedText.replace(/<li[^>]*><p>(.*?)<\/p><\/li>/g, "<li>$1</li>");
      // Group list items
      formattedText = formattedText.replace(/(<li[^>]*>.*?<\/li>)\s*<p>/g, "$1<ul>");
      formattedText = formattedText.replace(/<\/p>\s*(<li[^>]*>)/g, "</ul>$1");

      return formattedText;
    };

    return (
      <div>
        {parts.map((part, index) => {
          if (part.type === "text") {
            return (
              <div
                key={index}
                dangerouslySetInnerHTML={{ __html: processText(part.content || "") }}
              />
            );
          } else if (part.type === "code") {
            return (
              <div
                key={index}
                className="bg-gray-800 rounded-md p-4 text-gray-100 font-mono text-sm overflow-x-auto relative group my-4"
              >
                <div className="flex justify-between items-center mb-2">
                  {part.language && (
                    <div className="text-xs text-gray-400">{part.language}</div>
                  )}
                  <button
                    onClick={() => handleCopyCode(part.code || "", `${index}`)}
                    className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    {copiedCodeId === `${index}` ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap break-words max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] overflow-auto">
                  {part.code}
                </pre>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  // Render streaming content along with complete messages
  const renderMessages = () => {
    return (
      <div className="space-y-4">
        {messages.map((msg, index) => {
          // If this is the last message from the assistant and we're still streaming, show the streaming content
          const isLastAssistantMessage = index === messages.length - 1 && msg.role === "assistant";
          const content = isLastAssistantMessage && loading ? streamingContent : msg.content;

          return (
            <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[70%] px-4 py-3 rounded-2xl ${msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-none shadow-sm"
                    : "bg-white text-gray-800 rounded-tl-none shadow-md border border-gray-100"
                  }`}
              >
                {msg.role === "user" ? (
                  <div className="text-sm whitespace-pre-wrap">{content}</div>
                ) : (
                  <div className="text-sm">
                    {formatMessageContent(content)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {/* Show streaming content as it comes in if we're not updating an existing message */}
        {loading && streamingContent && messages.length > 0 && messages[messages.length - 1].role !== "assistant" && (
          <div className="flex justify-start">
            <div className="max-w-[70%] px-4 py-3 rounded-2xl bg-white text-gray-800 rounded-tl-none shadow-md border border-gray-100">
              <div className="text-sm">
                {formatMessageContent(streamingContent)}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      {/* Sidebar with history */}
      <div className={`${showSidebar ? "w-64" : "w-0"} bg-gray-50 border-r border-gray-200 transition-all duration-300 overflow-hidden flex flex-col`}>
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={startNewChat}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-colors flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Chat
          </button>
        </div>
        <div className="overflow-y-auto flex-grow">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider p-4 pb-2">Chat History</h2>
          <ul className="space-y-1 px-2">
            {chats.length > 0 ? (
              chats.map((chat) => (
                <li
                  key={chat.id}
                  className={`cursor-pointer rounded-lg transition-all px-3 py-2 ${currentChatId === chat.id
                      ? "bg-blue-100 text-blue-800 border-l-4 border-blue-600"
                      : "hover:bg-gray-100 text-gray-700"
                    }`}
                >
                  <div className="flex justify-between items-center">
                    <div
                      className="flex-1 flex flex-col"
                      onClick={() => {
                        setCurrentChatId(chat.id);
                        setMessages(chat.messages);
                      }}
                    >
                      {editingTitle === chat.id ? (
                        <input
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && updateChatTitle(chat.id)}
                          className="w-full p-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="font-medium truncate text-sm"
                          onDoubleClick={() => startEditingTitle(chat.id, chat.title)}
                        >
                          {truncateText(chat.title, 25)}
                        </span>
                      )}
                      <span className="text-xs opacity-60">{formatDate(chat.createdAt)}</span>
                    </div>
                    <button
                      className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))
            ) : (
              <p className="text-gray-400 text-sm text-center p-4">No past chats yet</p>
            )}
          </ul>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex items-center justify-between bg-white">
          <div className="flex items-center flex-1">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-md hover:bg-gray-100 mr-2 text-gray-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {currentChatId && (
              editingTitle === currentChatId ? (
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && updateChatTitle(currentChatId)}
                  className="flex-1 p-1 text-xl font-semibold border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              ) : (
                <div className="flex items-center flex-1">
                  <h1
                    className="text-xl font-semibold text-gray-800 mr-2 truncate"
                    onDoubleClick={() => {
                      const currentChat = getCurrentChat();
                      if (currentChat) {
                        startEditingTitle(currentChatId, currentChat.title);
                      }
                    }}
                  >
                    {getCurrentChat()?.title || "New Conversation"}
                  </h1>
                  <button
                    className="p-1 text-gray-400 hover:text-gray-700"
                    onClick={() => {
                      const currentChat = getCurrentChat();
                      if (currentChat) {
                        startEditingTitle(currentChatId, currentChat.title);
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              )
            )}

            {!currentChatId && (
              <h1 className="text-xl font-semibold text-gray-800">New Conversation</h1>
            )}
          </div>
          <div className="flex items-center">
            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
              gpt-4o-mini
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {messages.length > 0 ? (
            renderMessages()
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-xl font-medium mb-2">Start a conversation</p>
              <p className="text-sm max-w-sm text-center">Ask anything to the AI assistant powered by OpenAI&apos;s API</p>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="relative">
            <textarea
              className="w-full p-3 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              className="absolute right-3 bottom-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !input.trim()}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Powered by OpenAI API · Press Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}