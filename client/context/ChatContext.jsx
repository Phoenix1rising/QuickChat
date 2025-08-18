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
  const [messages, setMessages] = useState([]);
  const [unseenMessages, setUnseenMessages] = useState({});
  const { authUser } = useContext(AuthContext);

  const API_BASE = "/api/messages";

  // ✅ setup socket connection
  useEffect(() => {
    if (!authUser?._id) return;

    const socket = io("http://localhost:5000", {
      query: { userId: authUser._id },
    });

    // 👂 listen for new incoming messages
    socket.on("newMessage", (msg) => {
      console.log("📩 New incoming message:", msg);

      if (msg.senderId === selectedUser?._id) {
        // If we are chatting with the sender → append directly
        setMessages((prev) => [...prev, msg]);
        // mark as seen immediately
        markMessagesSeen(msg.senderId);
      } else {
        // If we are not in that chat → increment unseen counter
        setUnseenMessages((prev) => ({
          ...prev,
          [msg.senderId]: (prev[msg.senderId] || 0) + 1,
        }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [authUser, selectedUser]);

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
        setMessages((prev) => [
          ...prev,
          { ...res.data, senderId: authUser._id, createdAt: new Date() },
        ]);
      } catch (err) {
        console.error("Error sending message:", err);
        toast.error("Failed to send message.");
      }
    },
    [authUser]
  );

  // ✅ get messages for a user
  const getMessages = useCallback(async (userId) => {
    try {
      const res = await axios.get(`${API_BASE}/${userId}`);
      const dataArray = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data.messages)
        ? res.data.messages
        : [];
      setMessages(dataArray);
    } catch (err) {
      console.error("Error fetching messages:", err);
      toast.error("Failed to fetch messages.");
    }
  }, []);

  return (
    <ChatContext.Provider
      value={{
        users,
        selectedUser,
        setSelectedUser,
        messages,
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
