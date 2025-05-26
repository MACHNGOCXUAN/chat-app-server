import conversationModel from "../models/conversationModel.js";
import messageModel from "../models/messageModel.js";

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
.sort({ updatedAt: -1 });
 // sắp xếp theo thời gian cập nhật gần nhất

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

// ============ Cấp quyền cho nhóm ============
const updatePermission = async (req, res) => {
  try {
    const {setting, permission, conversationId} = req.body
    const userId = req.user._id
    
    const conversation = await conversationModel.findById(conversationId)
    if(!conversation) {
      return res.status(404).json({
        success: false,
        message: "Không tồn tại cuộc trò chuyện"
      })
    }

    // Kiểm tra xem có phải là nhóm không
    if (conversation.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể cập nhật quyền cho nhóm"
      });
    }

    // Kiểm tra xem người dùng có phải là thành viên không
    const isMember = conversation.members.some(
      member => member.userId.toString() === userId.toString()
    );
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Bạn không phải là thành viên của nhóm này"
      });
    }

    const isAdmin = conversation.members.some(
      member => member.userId.toString() === userId.toString() && member.role === 'admin'
    );

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Chỉ quản trị viên mới có thể thay đổi cài đặt nhóm"
      });
    }

    const validSettings = ['joinPermission', 'messagePermission'];
    if (!validSettings.includes(setting)) {
      return res.status(400).json({
        success: false,
        message: "Cài đặt không hợp lệ"
      });
    }

    const validPermissions = conversation.schema.path(`settings.${setting}`).enumValues;
    if (!validPermissions.includes(permission)) {
      return res.status(400).json({
        success: false,
        message: "Quyền không hợp lệ"
      });
    }

    conversation.settings[setting] = permission;
    conversation.lastUpdateAt = Date.now();

    const updatedConversation = await conversation.save();

    const settingNames = {
      messagePermission: "gửi tin nhắn",
      joinPermission: "tham gia nhóm",
    };

    const permissionNames = {
      admin: "chỉ quản trị viên",
      all: "tất cả thành viên",
    };

    const notificationMessage = {
      conversationId: conversation._id,
      senderId: userId,
      content: `Đã thay đổi quyền ${settingNames[setting]} thành ${permissionNames[permission]}`,
      messageType: "system",
      timestamp: new Date(),
    };

    const savedMessage = await messageModel.create(notificationMessage);

    const messageWithSender = await messageModel
          .findById(savedMessage._id)
          .populate("senderId", "username avatarURL");

    global._io.emit('group_settings_updated', {
      conversationId: conversation._id,
      setting,
      permission,
      updatedBy: userId
    });

    global._io.to(conversationId).emit("new_message", {
      ...savedMessage.toObject(),
      senderId: messageWithSender.senderId,
    });

    // conversation.members.forEach((member) => {
    //   global._io.to(member.userId.toString()).emit("new_message", {
    //     ...savedMessage.toObject(),
    //     senderId: messageWithSender.senderId
    //   });
    // });

    return res.status(200).json({
      success: true,
      message: "Cập nhật quyền thành công",
      conversation: updatedConversation
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật quyền:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật quyền",
      error: error.message
    });
  }
}

const conversationbyid = async (req, res) => {
  const id = req.params.id
  try {
    const conversation = await conversationModel.findById(id)
    if(!conversation) {
      return res.status(404).json("Khong ton tai converstion")
    }

    res.status(200).json({
      success: true,
      data: conversation
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật quyền",
      error: error.message
    });
  }
}

// ====================== Giải tán nhóm ====================
const groupDisbanded = async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user._id;

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cuộc trò chuyện"
      });
    }

    const isAdmin = conversation.members.some(
      member => member.userId.toString() === userId.toString() && member.role === 'admin'
    );
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Bạn không phải là quản trị viên của nhóm này"
      });
    }

    // Đánh dấu nhóm đã bị giải tán
    conversation.isActive = false;
    conversation.disbandedAt = new Date();
    conversation.disbandedBy = userId;
    await conversation.save();

    // Tạo tin nhắn thông báo giải tán nhóm
    const notificationMessage = {
      conversationId: conversation._id,
      senderId: userId,
      content: "Nhóm đã bị giải tán bởi quản trị viên",
      messageType: "system",
      timestamp: new Date(),
    };

    const savedMessage = await messageModel.create(notificationMessage);

    // Gửi thông báo đến tất cả thành viên
    global._io.emit('group_disbanded', {
      conversationId: conversation._id,
      message: notificationMessage,
      disbandedBy: userId
    });

    // Gửi thông báo riêng đến từng thành viên
    conversation.members.forEach(member => {
      if (member.userId.toString() !== userId.toString()) {
        global._io.to(member.userId.toString()).emit('removed_from_group', {
          conversationId: conversation._id,
          message: "Nhóm đã bị giải tán bởi quản trị viên"
        });
      }
    });

    res.status(200).json({
      success: true,
      message: "Cuộc trò chuyện đã được giải tán"
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi server khi giải tán nhóm",
      error: error.message
    });
  }
}
    
        

export const conversationContrller = {
  createConversation,
  getAllConversationByUser,
  getAllConversation,
  getGroupJoin,
  updatePermission,
  conversationbyid,
  groupDisbanded
}