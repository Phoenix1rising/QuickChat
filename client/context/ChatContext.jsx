import { createContext, useContext, useState, useCallback, useEffect } from "react";
import axios from "axios";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  const [allMessages, setAllMessages] = useState({});
  const [messages, setMessages] = useState([]);
  const [unseenMessages, setUnseenMessages] = useState({});

  const { authUser } = useContext(AuthContext);
  const API_BASE = "/api/messages";

  // Simple ObjectId validation (24 hex chars)
  const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

  // Add message to cache
  const addMessage = useCallback(
    (userId, msg) => {
      setAllMessages((prev) => {
        const updated = [...(prev[userId] || []), msg];
        if (selectedUser?._id === userId) setMessages(updated);
        return { ...prev, [userId]: updated };
      });
    },
    [selectedUser]
  );

  // Socket setup
  useEffect(() => {
    if (!authUser?._id) return;

    const socket = io("http://localhost:5000", {
      query: { userId: authUser._id },
    });

    socket.on("newMessage", (msg) => {
      const fromUser = msg.senderId;

      addMessage(fromUser, msg);

      if (fromUser === selectedUser?._id) {
        markMessagesSeen(fromUser);
      } else {
        setUnseenMessages((prev) => ({
          ...prev,
          [fromUser]: (prev[fromUser] || 0) + 1,
        }));
      }
    });

    return () => socket.disconnect();
  }, [authUser, selectedUser, addMessage]);

  // Fetch users
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

  // Mark messages as seen
  const markMessagesSeen = useCallback((userId) => {
    setUnseenMessages((prev) => ({ ...prev, [userId]: 0 }));
  }, []);

  // Send message
  const sendMessage = useCallback(
    async (msg, receiverId) => {
      if (!receiverId) return toast.error("No receiver selected.");
      if (!isValidObjectId(receiverId)) return toast.error("Invalid receiver ID.");

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

  // Get messages for a user
  const getMessages = useCallback(
    async (userId) => {
      setMessages([]);
      if (allMessages[userId]) {
        setMessages(allMessages[userId]);
        return;
      }

      try {
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
        setMessages,
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
