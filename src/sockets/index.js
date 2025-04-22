import authHandler from "./handlers/authHandler.js";
import userModel from "../models/userModel.js";
import conversationModel from "../models/conversationModel.js";
import messageModel from "../models/messageModel.js";
import uploadFile from "../utils/file.service.js";
import DeletedMessage from "../models/deleteMessageModel.js";
import groupMemberModel from "../models/groupMember.js";

const socketServer = (io) => {
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);


    // Xử lý join conversation 1-1 và nhóm
    socket.on("join_conversation",async ({ senderId, receiveId, conversationId }) => {
        try {
          let conversation;

          if (conversationId) {
            conversation = await conversationModel.findById(conversationId);
          }
          else {
            conversation = await conversationModel.findOne({
              type: "private",
              members: {
                $all: [
                  { $elemMatch: { userId: senderId } },
                  { $elemMatch: { userId: receiveId } },
                ],
                $size: 2,
              },
            });
          }

          socket.join(conversation._id.toString());
          socket.emit("joined_room", {
            conversationId: conversation._id.toString(),
          });
        } catch (error) {
          console.error("Join conversation error:", error);
        }
      }
    );

    // Xử lý join conversation nhóm
    socket.on("join_group_conversation", async ({ conversationId, userId }) => {
      try {
        const conversation = await conversationModel.findById(conversationId);
        if (!conversation) return;

        // Kiểm tra user có trong nhóm không
        const isMember = conversation.members.some(
          (m) => m.userId.toString() === userId
        );
        if (!isMember) return;

        // Join room
        socket.join(conversationId);
        socket.emit("joined_room", { conversationId });
      } catch (error) {
        console.error("Join group conversation error:", error);
      }
    });

    // Mỗi khi người dùng kết nối, join vào room của họ
    socket.on("joinUserRoom", (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined their room`);
    });

    // ============== Kiểm tra quyền của người dùng trong conversation ============
    const checkGroupPermission = async (
      conversationId,
      userId,
      requiredRole = "member"
    ) => {
      const conversation = await conversationModel.findById(conversationId);
      if (!conversation) return false;

      const member = conversation.members.find((m) => m.userId.equals(userId));
      if (!member) return false;

      if (requiredRole === "admin" && member.role !== "admin") return false;

      return true;
    };

    // =================== Tạo nhóm ======================
    socket.on(
      "create_group",
      async ({ creatorId, name, imageGroup, members }) => {
        try {
          console.log("zian: ", name);

          if (!imageGroup) {
            imageGroup =
              "https://img.freepik.com/free-vector/group-therapy-concept_23-2148655388.jpg?semt=ais_hybrid&w=740";
          }

          const newConversation = {
            name,
            type: "group",
            imageGroup,
            members: [
              { userId: creatorId, role: "admin" },
              ...members.map((userId) => ({
                userId,
                role: "member",
              })),
            ],
          };
          const conversation = await conversationModel.create(newConversation);

          console.log("conversation: ", conversation);

          conversation.members.forEach((member) => {
            io.to(member.userId._id.toString()).emit(
              "group_created",
              conversation
            );
          });
        } catch (error) {
          console.error("Không thể tạo nhóm:", error);
          socket.emit("error", { message: "Không thể tạo nhóm" });
        }
      }
    );

    // ======================== Gửi tin nhắn ============================
    socket.on("sendMessage", async (data) => {
      try {
        console.log("Data: ", data);

        const { senderId, rereceiveId, content, messageType } = data;
        let { conversationId } = data;

        console.log("data: ", data);

        if (!conversationId) {
          let conversation = await conversationModel.findOne({
            type: "private",
            members: {
              $all: [
                { $elemMatch: { userId: senderId } },
                { $elemMatch: { userId: rereceiveId } },
              ],
              $size: 2,
            },
          });

          if (!conversation) {
            conversation = await conversationModel.create({
              name: `${senderId} - ${rereceiveId}`,
              members: [
                { userId: senderId, role: "member" },
                { userId: rereceiveId, role: "member" },
              ],
              type: "private",
            });
          }
          conversationId = conversation._id.toString();

          // Thông báo cho client về conversationId mới
          socket.emit("conversation_created", { conversationId });
        }

        let messageContent = content;

        if (messageType == "image") {
          messageContent = Array.isArray(content) ? content : [content];
        } else if (messageType == "emoji") {
          messageContent = content.emojiCode;
        }
        const newMessage = new messageModel({
          conversationId,
          senderId,
          content: messageContent,
          messageType,
          is_last_message: true,
        });

        const savedMessage = await newMessage.save();

        const updatedConversation = await conversationModel.findByIdAndUpdate(
          conversationId,
          {
            lastMessage: savedMessage._id,
            updatedAt: new Date(),
          },
          {
            new: true,
            populate: [
              { path: "members.userId", select: "username avatarURL" },
              { path: "lastMessage" },
            ],
          }
        );

        const messageWithSender = await messageModel
          .findById(savedMessage._id)
          .populate("senderId", "username avatarURL");

        console.log("jjkjnk: ", messageContent);

        io.to(conversationId).emit("new_message", {
          ...savedMessage.toObject(),
          senderId: messageWithSender.senderId,
        });

        socket.to(conversationId).emit("receive_message", messageWithSender);
        socket.emit("message_sent", messageWithSender);

        updatedConversation.members.forEach((member) => {
          io.to(member.userId?._id.toString()).emit(
            "conversation_updated",
            updatedConversation
          );
        });
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("message_error", { error: "Failed to send message" });
      }
    });

    // ====================== Thu hồi tin nhắn ============================
    socket.on("recall_message", async (data) => {
      try {
        const { messageId, conversationId } = data;
        const updatedMessage = await messageModel
          .findByIdAndUpdate(
            messageId,
            {
              content: "Tin nhắn đã được thu hồi",
              messageType: "text",
              edited: true,
            },
            { new: true }
          )
          .populate("senderId", "username avatarURL");

        io.to(conversationId).emit("message_recalled", updatedMessage);
      } catch (error) {
        console.error("Error recalling message:", error);
        socket.emit("recall_error", { error: "Không thể thu hổi tin nhắn" });
      }
    });
    // xóa tin nhắn cục bộ
    socket.on("delete_message_local", async ({ messageId, userId }) => {
      try {
        const existed = await DeletedMessage.findOne({ messageId, userId });
        if (!existed) {
          await DeletedMessage.create({ messageId, userId });
        }
        socket.emit("message_deleted_local", { messageId });
      } catch (error) {
        console.error("Error deleting message locally:", error);
        socket.emit("delete_local_error", { error: "Xóa tin nhắn thất bại" });
      }
    });

    // socket.on('typing', (data) => {
    //   const { conversationId, userId } = data;
    //   socket.to(conversationId).emit('user_typing', { userId });
    // });

    // socket.on('stop_typing', (data) => {
    //   const { conversationId, userId } = data;
    //   socket.to(conversationId).emit('user_stop_typing', { userId });
    // });

    // =================== Thêm thành viên vào nhóm =========================
    socket.on("addMemberConversation", async ({ conversationId, members }) => {
      try {
        const newMembers = await members.map((member) => ({
          userId,
          role: "member",
        }));

        const updateConversation = await conversationModel
          .findOneAndUpdate(
            conversationId,
            { $push: { members: { $each: newMembers } } },
            { new: true }
          )
          .populate("members.userId", "username avatarURL");

        updateConversation.members.forEach((members) => {
          io.to(members.userId.toString()).emit(
            "conversation_updated",
            updateConversation
          );
        });
        members.forEach((userId) => {
          io.to(userId.toString()).emit("added_to_group", updatedConversation);
        });

        // members.forEach(userId => {
        //   io.to(userId.toString()).emit('added_to_group', updatedConversation);
        // });
      } catch (error) {
        console.error("Không thể thêm thành viên:", error);
        socket.emit("error", { message: "Không thể thêm thành viên" });
      }
    });

    // =================== Rời khỏi nhóm =========================
    socket.on("leave_conversation", async (conversationId, userId) => {
      try {
        const conversation = await conversationModel.findById(conversationId);
        if (!conversation) {
          return socket.emit("error", {
            message: "Cuộc trò chuyện không tồn tại",
          });
        }
        const memberIndex = conversation.members.findIndex((m) =>
          m.userId.equals(userId)
        );
        if (memberIndex === -1) {
          return socket.emit("error", {
            message: "Bạn không phải thành viên của cuộc trò chuyện này",
          });
        }

        const isAdmin = conversation.members[memberIndex].role === "admin";
        const adminCount = conversation.members.filter(
          (m) => m.role === "admin"
        ).length;
        if (isAdmin && adminCount === 1) {
          return socket.emit("error", {
            message: "Vui lòng chuyện quyền admin cho người khác",
          });
        }

        conversation.members.splice(memberIndex, 1);
        await conversation.save();

        // Thông báo cho tất cả thành viên
        updatedConversation.members.forEach((member) => {
          io.to(member.userId.toString()).emit("member_leave", {
            conversationId,
            userId,
            updatedConversation,
          });
        });

        // Thông báo cho người rời khỏi nhóm
        socket.emit("left_conversation", { conversationId });
        socket.leave(conversationId);

        if (updatedConversation.members.length === 0) {
          await conversationModel.findByIdAndDelete(conversationId);
          await messageModel.deleteMany({ conversationId });
          io.to(conversationId).emit("conversation_deleted", {
            conversationId,
          });
        }
      } catch (error) {
        console.error("Lỗi khi rời cuộc trò chuyện:", error);
        socket.emit("error", { message: "Lỗi khi rời cuộc trò chuyện" });
      }
    });

    socket.on(
      "update_member_role",
      async (conversationId, targetUserId, newRole, userIdUpdateRole) => {
        try {
          const conversation = await conversationModel.findById(conversationId);
          if (!conversation) {
            return socket.emit("error", {
              message: "Cuộc trò chuyện không tồn tại",
            });
          }

          if (conversation.type !== "group") {
            return socket.emit("error", {
              message: "Chỉ có thể cập nhật quyền trong nhóm",
            });
          }

          const requester = conversation.members.find((m) =>
            m.userId.equals(userIdUpdateRole)
          );
          if (requester || requester.role !== "admin") {
            return socket.emit("error", {
              message: "Bạn không có quyền thực hiện hành động này",
            });
          }

          const targetMember = conversation.members.find((m) =>
            m.userId.equals(targetUserId)
          );
          if (!targetMember) {
            return socket.emit("error", {
              message: "Thành viên không tồn tại trong nhóm",
            });
          }

          if (targetUserId === userIdUpdateRole) {
            return socket.emit("error", {
              message: "Không thể tự thay đổi quyền của chính mình",
            });
          }

          targetMember.role = newRole;
          await conversation.save();

          const updatedConversation = await conversationModel
            .findById(conversationId)
            .populate("members.userId", "username avatarURL")
            .populate("lastMessage");

          updatedConversation.members.forEach((member) => {
            io.to(member.userId.toString()).emit("member_role_updated", {
              conversationId,
              targetUserId,
              newRole,
              updatedConversation,
            });
          });
        } catch (error) {
          console.error("Lỗi khi cập nhật quyền thành viên:", error);
          socket.emit("error", {
            message: "Lỗi khi cập nhật quyền thành viên",
          });
        }
      }
    );

    socket.on("disconnect", (reason) => {
      console.log("Client disconnected:", socket.id);
      if (reason === "transport close") {
        console.log("Đang chờ kết nối lại...");
      }
    });
  });
};

export default socketServer;
