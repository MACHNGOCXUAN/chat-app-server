import conversationModel from "../models/conversationModel.js";

const createConversation = async (req, res) => {
  try {
    const { members, name, type } = req.body;

    if (type === 'private' && members.length === 2) {
      const existingConversation = await conversationModel.findOne({
        type: 'private',
        members: { $all: members, $size: 2 },
      });

      if (existingConversation) {
        return res.status(200).json(existingConversation);
      }
    }

    const newConversation = new conversationModel({
      name,
      type,
      members,
    });

    const savedConversation = await newConversation.save();

    res.status(201).json(savedConversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const getAllConversationByUser = async (req, res) => {
  try {
    const emailUser = req.user.email;
    const conversations = await conversationModel.find({
      members: { $in: [userId] },
    })
      .populate('members', 'username avatarURL')
      .populate('lastMessage')
      .sort({ 'lastMessage.timestamp': -1 });

    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

const getAllConversation = async (req, res) => {
  try {
    const userId = req.user._id;
    const conversations = await conversationModel.find({
      "members.userId": userId
    })
    .populate('members.userId', 'username avatarURL')
    .populate('lastMessage')
    .sort({ updatedAt: -1 }); // sắp xếp theo thời gian cập nhật gần nhất

    res.status(200).json({
      success: true,
      message: "Danh sách cuộc trò chuyện đã được lấy thành công.",
      data: conversations
    });

  } catch (error) {
    console.error("Lỗi khi lấy danh sách cuộc trò chuyện:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Không thể lấy cuộc trò chuyện.",
      error: error.message
    });
  }
};

const getGroupJoin = async (req, res) =>{
  try {
    const userId = req.user._id
    const conversations = await conversationModel.find({
      "members.userId": userId, type: 'group'
    })
    .populate('members.userId', 'username avatarURL')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: conversations
    })
  } catch (error) {
    console.error("Lỗi khi lấy danh sách cuộc trò chuyện:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Không thể lấy cuộc trò chuyện.",
      error: error.message
    });
  }
}


export const conversationContrller = {
  createConversation,
  getAllConversationByUser,
  getAllConversation,
  getGroupJoin
}