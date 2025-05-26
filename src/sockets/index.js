import authHandler from "./handlers/authHandler.js";
import userModel from "../models/userModel.js";
import conversationModel from "../models/conversationModel.js";
import messageModel from "../models/messageModel.js";
import uploadFile from "../utils/file.service.js";
import DeletedMessage from "../models/deleteMessageModel.js";
import groupMemberModel from "../models/groupMember.js";
import mongoose from "mongoose";
const socketServer = (io) => {
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Xử lý join conversation 1-1 và nhóm
    socket.on(
      "join_conversation",
      async ({ senderId, receiveId, conversationId }) => {
        try {
          let conversation;

          if (conversationId) {
            conversation = await conversationModel.findById(conversationId);
          } else {
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

          conversation.members.forEach((member) => {
            io.to(member.userId.toString()).emit("group_created", conversation);
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

        const { senderId, content, messageType } = data;
        let { conversationId } = data;

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
        // Lấy conversation để biết thành viên
        const conversation = await conversationModel.findById(conversationId);

        // Lấy danh sách userId những người nhận (members ngoại trừ sender)
        const receiverIds = conversation.members
          .map((m) => m.userId.toString())
          .filter((id) => id !== senderId);
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
          readBy: [senderId],
        });
        const savedMessage = await newMessage.save();
        // Cập nhật conversation: lastMessage, updatedAt, tăng unreadCount cho từng receiver
        const updateUnreadInc = {};
        receiverIds.forEach((rId) => {
          updateUnreadInc[`unreadCount.${rId}`] = 1;
        });
        const updatedConversation = await conversationModel.findByIdAndUpdate(
          conversationId,
          {
            lastMessage: savedMessage._id,
            updatedAt: new Date(),
            $inc: updateUnreadInc,
          },
          {
            new: true,
            populate: [
              { path: "members.userId", select: "username avatarURL" },
              { path: "lastMessage" },
            ],
          }
        );
        // Gửi sự kiện cập nhật số lượng tin chưa đọc cho tất cả người nhận
        receiverIds.forEach((rId) => {
          io.to(rId).emit("unread_updated", {
            conversationId,
            count: updatedConversation.unreadCount[rId] || 1,
          });
        });

        const messageWithSender = await messageModel
          .findById(savedMessage._id)
          .populate("senderId", "username avatarURL");

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

    // Xử lý request lấy danh sách thành viên của nhóm
    socket.on("getGroupMembers", async ({ conversationId }) => {
      try {
        // Tìm nhóm trong cơ sở dữ liệu
        const conversation = await conversationModel
          .findById(conversationId)
          .populate({
            path: "members.userId",
            select: "username avatarURL",
            options: { strictPopulate: false }, // tạm thời cho phép populate dù schema lỏng
          });

        if (!conversation) {
          return socket.emit("error", { message: "Không tìm thấy nhóm" });
        }

        // Trả về danh sách thành viên của nhóm
        socket.emit("group_members", {
          members: conversation.members,
          conversationId,
        });
      } catch (error) {
        console.error("Lỗi khi lấy danh sách thành viên:", error);
        socket.emit("error", { message: "Lỗi khi lấy danh sách thành viên" });
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
          userId: member,
          role: "member",
        }));

        const updateConversation = await conversationModel
          .findOneAndUpdate(
            { _id: conversationId },
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
          io.to(userId.toString()).emit("added_to_group", updateConversation);
        });

        // members.forEach(userId => {
        //   io.to(userId.toString()).emit('added_to_group', updatedConversation);
        // });
      } catch (error) {
        console.error("Không thể thêm thành viên:", error);
        socket.emit("error", { message: "Không thể thêm thành viên" });
      }
    });
    // xóa
    socket.on(
      "removeMemberConversation",
      async ({ conversationId, userId }) => {
        try {
          const updatedConversation = await conversationModel
            .findOneAndUpdate(
              { _id: conversationId },
              { $pull: { members: { userId: userId } } }, // Loại bỏ thành viên khỏi mảng members
              { new: true }
            )
            .populate("members.userId", "username avatarURL");

          // Emit sự thay đổi cho tất cả các thành viên trong nhóm
          updatedConversation.members.forEach((member) => {
            io.to(member.userId.toString()).emit(
              "conversation_updated",
              updatedConversation
            );
          });

          // Thông báo cho người dùng đã bị xóa
          io.to(userId.toString()).emit(
            "removed_from_group",
            updatedConversation
          );
        } catch (error) {
          console.error("Không thể xóa thành viên:", error);
          socket.emit("error", { message: "Không thể xóa thành viên" });
        }
      }
    );
    // =================== Rời khỏi nhóm =========================
    socket.on("leave_conversation", async (conversationIdRaw, userIdRaw) => {
      console.log(
        "🔔 Sự kiện leave_conversation nhận được:",
        conversationIdRaw,
        userIdRaw
      );

      // if (!mongoose.Types.ObjectId.isValid(conversationIdRaw)) {
      //   return socket.emit("leave_conversation_error", {
      //     message: "conversationId không hợp lệ",
      //   });
      // }
      try {
        console.log("Yêu cầu rời nhóm:", { conversationIdRaw, userIdRaw });

        const conversationId = new mongoose.Types.ObjectId(conversationIdRaw);
        const userId = new mongoose.Types.ObjectId(userIdRaw);

        const conversation = await conversationModel.findById(conversationId);

        if (!conversation) {
          return socket.emit("leave_conversation_error", {
            message: "Cuộc trò chuyện không tồn tại",
          });
        }

        const memberIndex = conversation.members.findIndex((m) =>
          m.userId.equals(userId)
        );

        if (memberIndex === -1) {
          return socket.emit("leave_conversation_error", {
            message: "Bạn không phải thành viên của cuộc trò chuyện này",
          });
        }

        const isAdmin = conversation.members[memberIndex].role === "admin";
        const adminCount = conversation.members.filter(
          (m) => m.role === "admin"
        ).length;

        if (isAdmin && adminCount === 1 && conversation.members.length > 1) {
          return socket.emit("leave_conversation_error", {
            message:
              "Vui lòng chuyển quyền admin cho người khác trước khi rời nhóm.",
          });
        }

        // Xóa người dùng khỏi danh sách thành viên
        conversation.members.splice(memberIndex, 1);
        await conversation.save();

        const updatedConversation = await conversationModel.findById(
          conversationId
        );

        // Gửi thông báo đến các thành viên còn lại
        updatedConversation.members.forEach((member) => {
          io.to(member.userId.toString()).emit("member_leave", {
            conversationId: conversationId.toString(),
            userId: userId.toString(),
            updatedConversation,
          });
        });

        // Gửi phản hồi về cho chính người vừa rời nhóm
        socket.emit("left_conversation", {
          conversationId: conversationId.toString(),
        });

        // Thoát khỏi room socket
        socket.leave(conversationId.toString());

        // Nếu không còn thành viên nào thì xóa cuộc trò chuyện
        if (updatedConversation.members.length === 0) {
          await conversationModel.findByIdAndDelete(conversationId);
          await messageModel.deleteMany({ conversationId });

          io.to(conversationId.toString()).emit("conversation_deleted", {
            conversationId: conversationId.toString(),
          });
        }
      } catch (error) {
        console.error("Lỗi khi rời cuộc trò chuyện:", error);
        socket.emit("leave_conversation_error", {
          message: "Đã xảy ra lỗi khi rời cuộc trò chuyện.",
        });
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
          if (!requester || requester.role !== "admin") {
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

          // Cập nhật quyền của thành viên mục tiêu
          targetMember.role = newRole;

          // Kiểm tra nếu người yêu cầu chuyển quyền admin cho người khác, thì đổi quyền admin của họ về thành viên
          if (newRole === "admin" && requester.role === "admin") {
            // Tìm người admin khác để chuyển quyền admin cho họ, hoặc thay đổi quyền admin của người yêu cầu thành "member" (nếu có ít hơn 2 admin)
            const adminCount = conversation.members.filter(
              (m) => m.role === "admin"
            ).length;
            if (adminCount === 1) {
              return socket.emit("error", {
                message: "Vui lòng đảm bảo có ít nhất một admin trong nhóm",
              });
            }

            // Nếu đã có đủ admin, chuyển quyền admin cho người được yêu cầu
            requester.role = "member"; // Cập nhật quyền của người yêu cầu (có thể là admin đang chuyển quyền)
          }

          await conversation.save();

          const updatedConversation = await conversationModel
            .findById(conversationId)
            .populate("members.userId", "username avatarURL")
            .populate("lastMessage");

          // Cập nhật quyền của tất cả thành viên
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

    // ==================== Chuyển tiếp tin nhắn ====================
    socket.on(
      "forward_message",
      async ({ originalMessage, targetConversations, senderId }) => {
        if (
          !originalMessage ||
          !targetConversations ||
          !targetConversations.length
        ) {
          return socket.emit("forward_error", {
            message: "Dữ liệu không hợp lệ",
          });
        }

        const sender = await userModel.findById(senderId);
        if (!sender) {
          return socket.emit("forward_error", {
            message: "Người gửi không tồn tại",
          });
        }

        // Gửi đến từng conversation đích
        const results = await Promise.all(
          targetConversations.map(async (target) => {
            try {
              let conversation;

              // Nếu là chuyển tiếp đến nhóm
              if (target.type === "group") {
                conversation = await conversationModel.findById(target._id);
                if (!conversation) {
                  return {
                    success: false,
                    conversationId: target._id,
                    error: "Nhóm không tồn tại",
                  };
                }

                // Kiểm tra người gửi có trong nhóm không
                const isMember = conversation.members.some((m) =>
                  m.userId.equals(senderId)
                );
                if (!isMember) {
                  return {
                    success: false,
                    conversationId: target._id,
                    error: "Bạn không phải thành viên nhóm",
                  };
                }
              }
              // Nếu là chuyển tiếp đến cá nhân
              else {
                // Tìm hoặc tạo conversation với người nhận
                const receiverId = target._id;
                conversation = await conversationModel.findOne({
                  type: "private",
                  members: {
                    $all: [
                      { $elemMatch: { userId: senderId } },
                      { $elemMatch: { userId: receiverId } },
                    ],
                    $size: 2,
                  },
                });
              }

              // Tạo tin nhắn chuyển tiếp
              const newMessage = new messageModel({
                conversationId: conversation._id,
                senderId,
                content: originalMessage.content,
                messageType: originalMessage.messageType,
                is_last_message: true,
              });

              const savedMessage = await newMessage.save();

              // Cập nhật lastMessage của conversation
              const updatedConversation =
                await conversationModel.findByIdAndUpdate(
                  conversation._id,
                  {
                    lastMessage: savedMessage._id,
                    updatedAt: new Date(),
                  },
                  {
                    new: true,
                    populate: [
                      {
                        path: "members.userId",
                        select: "username avatarURL",
                      },
                      { path: "lastMessage" },
                    ],
                  }
                );

              // Populate thông tin người gửi
              const messageWithSender = await messageModel
                .findById(savedMessage._id)
                .populate("senderId", "username avatarURL");

              console.log("nkjnkj: ", messageWithSender);

              io.to(conversation?._id).emit("new_message", {
                ...savedMessage.toObject(),
                senderId: messageWithSender.senderId,
              });

              socket
                .to(conversation?._id)
                .emit("receive_message", messageWithSender);
              socket.emit("message_sent", messageWithSender);

              conversation.members.forEach((member) => {
                io.to(member.userId.toString()).emit(
                  "forwardConversation",
                  conversation
                );
              });

              // Cập nhật danh sách conversation cho các thành viên
              updatedConversation.members.forEach((member) => {
                io.to(member?.userId.toString()).emit(
                  "conversation_updated",
                  updatedConversation
                );
              });

              return { success: true, conversationId: conversation._id };
            } catch (error) {
              console.error("Lỗi trong quá trình chuyển tiếp:", error);
              return {
                success: false,
                conversationId: target._id,
                error: error.message,
              };
            }
          })
        );

        // Xử lý kết quả tổng hợp sau khi chuyển tiếp
        const failedConversations = results.filter((r) => !r.success);

        if (failedConversations.length === 0) {
          socket.emit("forward_success", {
            message: "Chuyển tiếp thành công",
          });
        } else if (failedConversations.length > 0) {
          socket.emit("forward_partial_error", {
            message: "Một số tin nhắn chuyển tiếp không thành công",
            errors: failedConversations,
          });
        }
      }
    );

    async function transferAdminRole(
      conversationId,
      currentAdminId,
      newAdminId
    ) {
      const conversation = await conversationModel.findById(conversationId);
      if (!conversation) throw new Error("Conversation not found");
      if (conversation.type !== "group")
        throw new Error("Only group chats can have admin transfers");

      const currentAdmin = conversation.members.find(
        (m) => m.userId.toString() === currentAdminId && m.role === "admin"
      );
      if (!currentAdmin) throw new Error("Bạn không phải là admin");

      const newAdmin = conversation.members.find(
        (m) => m.userId.toString() === newAdminId
      );
      if (!newAdmin) throw new Error("New admin is not a member of the group");

      // Thực hiện chuyển quyền
      currentAdmin.role = "member";
      newAdmin.role = "admin";
      conversation.lastUpdateAt = new Date();

      return await conversation.save();
    }

    // ========= Chuyển quyền admin cho thành viên khác ===============
    socket.on("transfer-admin", async (data) => {
      try {
        const { conversationId, currentAdminId, newAdminId } = data;
        const updatedConversation = await transferAdminRole(
          conversationId,
          currentAdminId,
          newAdminId
        );

        io.to(conversationId).emit("admin-transferred", {
          conversation: updatedConversation,
          newAdminId,
          oldAdminId: currentAdminId,
        });
      } catch (error) {
        socket.emit("transfer-admin-error", {
          message: error.message,
        });
      }
    });

    socket.on("user-online", (userId) => {
      io.emit("user-status", { userId, isOnline: true });
    });

    socket.on("disconnect", () => {
      if (socket.userId) {
        io.emit("user-status", { userId: socket.userId, isOnline: false });
      }
    });

    socket.on("mark_conversation_read", async ({ conversationId, userId }) => {
      try {
        // 1. Đánh dấu tất cả các tin nhắn chưa đọc là đã đọc
        await messageModel.updateMany(
          {
            conversationId,
            readBy: { $ne: userId },
          },
          {
            $addToSet: { readBy: userId }, // Tránh thêm trùng userId
          }
        );

        // 2. Reset số lượng chưa đọc
        await conversationModel.findByIdAndUpdate(conversationId, {
          $set: {
            [`unreadCount.${userId}`]: 0,
          },
        });

        // 3. Emit về client
        io.to(userId).emit("unread_updated", {
          conversationId,
          count: 0,
        });
      } catch (error) {
        console.error("Failed to mark conversation as read", error);
      }
    });
  });
};

export default socketServer;
