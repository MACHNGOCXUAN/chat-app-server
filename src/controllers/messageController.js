import messageModel from "../models/messageModel.js"

// Lấy tất cả tin nhắn từ cuộc trò chuyện
const getMessageConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await messageModel.find({ conversationId })
      .populate("senderId", "username avatarURL")
      .sort({ timestamp: 1 })
      .exec();

    if (!messages || messages.length === 0) {
      return res.status(404).json({ success: false, message: "Không có tin nhắn nào" });
    }

    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại sau!' });
  }
};

// xóa tin nhắn




export const messageController = {
  getMessageConversation
}