import { createContext, useContext, useState, useCallback, useEffect } from "react";
import axios from "axios";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";
import mongoose from "mongoose";
import { io } from "socket.io-client";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // store all messages grouped by userId
  const [allMessages, setAllMessages] = useState({});
  const [messages, setMessages] = useState([]);

  const [unseenMessages, setUnseenMessages] = useState({});
  const { authUser } = useContext(AuthContext);

  const API_BASE = "/api/messages";

  // helper to add message to cache
  const addMessage = useCallback(
    (userId, msg) => {
      setAllMessages((prev) => {
        const updated = [...(prev[userId] || []), msg];
        // update active chat if open
        if (selectedUser?._id === userId) {
          setMessages(updated);
        }
        return { ...prev, [userId]: updated };
      });
    },
    [selectedUser]
  );

  // ✅ setup socket connection
  useEffect(() => {
    if (!authUser?._id) return;

    const socket = io("http://localhost:5000", {
      query: { userId: authUser._id },
    });

    socket.on("newMessage", (msg) => {
      console.log("📩 New incoming message:", msg);

      const fromUser = msg.senderId;

      if (fromUser === selectedUser?._id) {
        // currently chatting with this user
        addMessage(fromUser, msg);
        markMessagesSeen(fromUser);
      } else {
        // increase unseen count
        setUnseenMessages((prev) => ({
          ...prev,
          [fromUser]: (prev[fromUser] || 0) + 1,
        }));
        // still store in cache
        addMessage(fromUser, msg);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [authUser, selectedUser, addMessage]);

  // ✅ fetch users
  const getUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/users`);
      const dataArray = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data.users)
        ? res.data.users
        : [];

      setUsers(dataArray.filter((user) => user._id !== authUser?._id));
    } catch (err) {
      console.error("Error fetching users:", err);
      toast.error("Failed to fetch users. Please try again.");
    }
  }, [authUser]);

  // ✅ mark messages as seen
  const markMessagesSeen = useCallback((userId) => {
    setUnseenMessages((prev) => ({ ...prev, [userId]: 0 }));
  }, []);

  // ✅ send message
  const sendMessage = useCallback(
    async (msg, receiverId) => {
      if (!receiverId) {
        toast.error("No receiver selected.");
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(receiverId)) {
        toast.error("Invalid receiver ID.");
        return;
      }

      try {
        const res = await axios.post(`${API_BASE}/send/${receiverId}`, msg);
        const newMsg = { ...res.data, senderId: authUser._id, createdAt: new Date() };
        addMessage(receiverId, newMsg);
      } catch (err) {
        console.error("Error sending message:", err);
        toast.error("Failed to send message.");
      }
    },
    [authUser, addMessage]
  );

  // ✅ get messages for a user
  const getMessages = useCallback(
    async (userId) => {
      try {
        // clear previous messages instantly when switching
        setMessages([]);

        // use cache if available
        if (allMessages[userId]) {
          setMessages(allMessages[userId]);
          return;
        }

        // fetch from API
        const res = await axios.get(`${API_BASE}/${userId}`);
        const dataArray = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data.messages)
          ? res.data.messages
          : [];

        setAllMessages((prev) => ({ ...prev, [userId]: dataArray }));
        setMessages(dataArray);
      } catch (err) {
        console.error("Error fetching messages:", err);
        toast.error("Failed to fetch messages.");
      }
    },
    [allMessages]
  );

  return (
    <ChatContext.Provider
      value={{
        users,
        selectedUser,
        setSelectedUser,
        messages,
        setMessages,      // ✅ expose so ChatContainer can reset manually
        unseenMessages,
        getUsers,
        markMessagesSeen,
        sendMessage,
        getMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
