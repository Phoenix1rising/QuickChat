import React, { useContext, useEffect, useRef, useState } from "react";
import assets from "../assets/assets";
import { formatMessageTime } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";

const ChatContainer = () => {
  const { messages, setMessages, selectedUser, setSelectedUser, sendMessage, getMessages } =
    useContext(ChatContext);
  const { authUser, onlineUsers } = useContext(AuthContext);

  const scrollEnd = useRef(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // ✅ Load messages for selected user and clear old messages
  useEffect(() => {
    if (selectedUser?._id) {
      setMessages([]); // clear previous messages immediately
      getMessages(selectedUser._id);
    }
  }, [selectedUser, getMessages, setMessages]);

  // ✅ Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage({ text: input.trim() }, selectedUser?._id);
      setInput("");
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleSendImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await sendMessage({ image: reader.result }, selectedUser?._id);
      } catch {
        toast.error("Failed to send image. Please try again.");
      }
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  if (!selectedUser) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden">
        <img src={assets.logo_icon} alt="Logo" className="max-w-16" />
        <p className="text-lg font-medium text-white">Chat anytime, anywhere</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-scroll relative backdrop-blur-lg">
      {/* Header */}
      <div className="flex items-center gap-3 py-3 mx-4 border-b border-stone-500">
        <img
          src={selectedUser.profilePic || assets.avatar_icon}
          className="w-8 rounded-full"
          alt={`${selectedUser.fullName} profile`}
        />
        <p className="flex-1 text-lg text-white flex items-center gap-2">
          {selectedUser.fullName}
          {onlineUsers.includes(selectedUser._id) && (
            <span className="w-2 h-2 rounded-full bg-green-500" />
          )}
        </p>
        <img
          onClick={() => setSelectedUser(null)}
          src={assets.arrow_icon}
          alt="Back"
          className="md:hidden max-w-7 cursor-pointer"
        />
        <img
          src={assets.help_icon}
          alt="Help"
          className="max-md:hidden max-w-5"
        />
      </div>

      {/* Messages */}
      <div className="flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-3 pb-6">
        {messages.map((msg, index) => {
          const isOwnMessage = msg.senderId === authUser._id;
          return (
            <div
              key={index}
              className={`flex items-end gap-2 ${
                isOwnMessage ? "justify-end" : "flex-row-reverse"
              }`}
            >
              {msg.image ? (
                <img
                  src={msg.image}
                  alt="Sent media"
                  className="max-w-[230px] border border-gray-700 rounded-lg overflow-hidden mb-8"
                />
              ) : (
                <p
                  className={`p-2 max-w-[200px] md:text-sm font-light rounded-lg mb-8 break-all bg-violet-500/30 text-white ${
                    isOwnMessage ? "rounded-br-none" : "rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </p>
              )}
              <div className="text-center text-xs">
                <img
                  src={
                    isOwnMessage
                      ? authUser?.profilePic || assets.avatar_icon
                      : selectedUser?.profilePic || assets.avatar_icon
                  }
                  alt={`${isOwnMessage ? "Your" : selectedUser.fullName} profile`}
                  className="w-7 rounded-full"
                />
                <p className="text-gray-500">
                  {formatMessageTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={scrollEnd}></div>
      </div>

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        className="absolute bottom-0 left-0 right-0 flex items-center gap-3 p-3"
      >
        <div className="flex-1 flex items-center bg-gray-100/12 px-3 rounded-full">
          <input
            onChange={(e) => setInput(e.target.value)}
            value={input}
            type="text"
            placeholder="Send a message"
            className="flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400"
            disabled={sending}
          />
          <input
            onChange={handleSendImage}
            type="file"
            id="image"
            accept="image/png, image/jpeg"
            hidden
          />
          <label htmlFor="image">
            <img
              src={assets.gallery_icon}
              className="w-5 mr-2 cursor-pointer"
              alt="Attach image"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={sending}
          className="w-7 cursor-pointer bg-transparent border-none p-0"
        >
          <img src={assets.send_button} alt="Send" />
        </button>
      </form>
    </div>
  );
};

export default ChatContainer;
