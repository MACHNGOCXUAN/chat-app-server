import messageModel from "../models/messageModel.js"
import DeletedMessage from '../models/deleteMessageModel.js';
import uploadFile from "../utils/file.service.js";
import conversationModel from "../models/conversationModel.js";

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
// Xóa tin nhắn cục bộ
const deleteMessageLocally = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;  // Lấy userId từ middleware xác thực

    // Kiểm tra xem tin nhắn này đã được xóa cục bộ chưa
    const existed = await DeletedMessage.findOne({ messageId, userId });

    if (!existed) {
      // Nếu chưa xóa, tạo một bản ghi mới trong DeletedMessage
      await DeletedMessage.create({ messageId, userId });
    }

    // Trả về thông báo xóa tin nhắn thành công
    return res.status(200).json({ success: true, message: 'Xóa tin nhắn thành công!' });
  } catch (error) {
    console.error('Lỗi khi xóa tin nhắn cục bộ:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại sau!' });
  }
};

//Lấy tin nhắn sau khi lọc cục bộ
const getFilterMessageConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id; // Đảm bảo middleware xác thực gán userId

    // Lấy các messageId mà người dùng này đã xóa trong cuộc trò chuyện
    const deletedMessages = await DeletedMessage.find({ userId });
    const deletedIds = deletedMessages.map(dm => dm.messageId.toString());

    // Lấy tất cả tin nhắn trong cuộc trò chuyện
    const messages = await messageModel.find({ conversationId })
      .populate("senderId", "username avatarURL")
      .sort({ timestamp: 1 })
      .exec();

    // Lọc bỏ các tin nhắn đã bị user này xóa
    const filteredMessages = messages.filter(msg => !deletedIds.includes(msg._id.toString()));

    if (filteredMessages.length === 0) {
      return res.status(404).json({ success: false, message: "Không có tin nhắn nào" });
    }

    return res.status(200).json({ success: true, data: filteredMessages });
  } catch (error) {
    console.error("Lỗi khi lấy tin nhắn:", error);
    return res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại sau!' });
  }
};

const uploadImage = async (req, res) => {
  try {
    const imageURL = req.files?.avatarURL?.[0]
    const avatar = await uploadFile(imageURL)
    res.status(200).json({success: true, data: avatar})
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại sau!' });
  }
}

const uploadNhieuFile = async (req, res) => {
  try {
    const files = req.files?.ArrayFile;

    console.log("files: ", files);
    

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có file nào được gửi lên!' });
    }

    const uploadedUrls = await Promise.all(
      files.map(file => uploadFile(file))
    );

    res.status(200).json({ success: true, data: uploadedUrls });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại sau!' });
  }
};


const deleteMessageForUser  = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;
    const message = await messageModel.findById(messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: "Tin nhắn không tồn tại" });
    }

    const conversation = await conversationModel.findById(message.conversationId);
    const isMember = conversation.members.some(m => m.userId.equals(userId));


    if (!isMember) {
      return res.status(403).json({ success: false, message: "Không có quyền xóa tin nhắn" });
    }

    if (!message.deletedFor.includes(userId)) {
      message.deletedFor.push(userId);
      await message.save();
    }

    global._io.to(userId.toString).emit('message_deleted_for_me', { messageId })
    io.to(message.conversationId.toString()).emit('message_deleted_for_user', {
      messageId,
      deletedBy: userId
    });

    res.status(200).json({ success: true, message: "Đã xóa tin nhắn thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại sau!' });
  }
}




export const messageController = {
  getMessageConversation,
  getFilterMessageConversation,
  deleteMessageLocally,
  uploadImage,
  uploadNhieuFile,
  deleteMessageForUser
}