import authHandler from "./handlers/authHandler.js";
import userModel from "../models/userModel.js";
import conversationModel from "../models/conversationModel.js";
import messageModel from '../models/messageModel.js'
import uploadFile from "../utils/file.service.js";
import DeletedMessage from '../models/deleteMessageModel.js';

const socketServer = (io) => {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Tham gia cuộc trò chuyện
    socket.on('join_conversation', async ({senderId, rereceiveId}) => {
      console.log('join_conversation called with:');
      console.log('senderId:', senderId);
      console.log('rereceiveId:', rereceiveId);
      let conversation = await conversationModel.findOne({
        type: 'private',
        members: {
          $all: [senderId, rereceiveId],
          $size: 2
        }
      });
      if (!conversation) {
        conversation = await conversationModel.create({
          name: `${senderId} - ${rereceiveId}`,
          members: [senderId, rereceiveId]
        });
      }
      socket.join(conversation._id.toString());
      socket.emit("joined_room", { conversationId: conversation._id });
    });

    socket.on('joinUserRoom', (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined their room`);
    });

    // socket.on('leave_conversation', (conversationId) => {
    //   socket.leave(conversationId);
    //   console.log(`User left conversation: ${conversationId}`);
    // });

    
    // Gửi tin nhắn
    socket.on("sendMessage", async (data) => {
      try {
          const { conversationId, senderId, content, messageType } = data;
          let messageContent = content;
          if (messageType !== 'text' && typeof content !== 'string') {
            messageContent = await uploadFile(content); // chỉ upload nếu content là file
          }

  
          const newMessage = new messageModel({
              conversationId,
              senderId,
              content: messageContent,
              messageType,
              is_last_message: true,
          });
  
          const savedMessage = await newMessage.save();  // Lưu tin nhắn vào DB
  
          const updatedConversation = await conversationModel.findByIdAndUpdate(
              conversationId,
              {
                  lastMessage: savedMessage._id,
                  updatedAt: new Date(),
              },
              { 
                  new: true,
                  populate: [
                      { path: 'members', select: 'username avatarURL' },
                      { path: 'lastMessage' }
                  ]
              }
          );
  
          const messageWithSender = await messageModel.findById(savedMessage._id)
              .populate('senderId', 'username avatarURL');
  
          socket.to(conversationId).emit('receive_message', messageWithSender);
          socket.emit('message_sent', messageWithSender);
  
          updatedConversation.members.forEach(member => {
              io.to(member._id.toString()).emit('conversation_updated', updatedConversation);
          });
        const { conversationId, senderId, content, messageType } = data;
        
        let messageContent = content;
        
        if (messageType == 'image') {
          messageContent = content
        } else if (messageType == 'emoji') {
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
              { path: 'members', select: 'username avatarURL' },
              { path: 'lastMessage' }
            ]
          }
        );

        const messageWithSender = await messageModel.findById(savedMessage._id)
          .populate('senderId', 'username avatarURL');

        socket.to(conversationId).emit('receive_message', messageWithSender);
        socket.emit('message_sent', messageWithSender);

        updatedConversation.members.forEach(member => {
          io.to(member._id.toString()).emit('conversation_updated', updatedConversation);
        });
      } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('message_error', { error: 'Failed to send message' });
      }
  });
  

    // Thu hồi tin nhắn
    socket.on('recall_message', async (data) => {
      try {
        const { messageId, conversationId } = data;
        const updatedMessage = await messageModel.findByIdAndUpdate(
          messageId,
          { content: 'Tin nhắn đã được thu hồi', messageType: 'text', edited: true },
          { new: true }
        ).populate('senderId', 'username avatarURL');

        io.to(conversationId).emit('message_recalled', updatedMessage);

      } catch (error) {
        console.error('Error recalling message:', error);
        socket.emit('recall_error', { error: 'Không thể thu hổi tin nhắn' });
      }
    });
    // xóa tin nhắn cục bộ
    socket.on('delete_message_local', async ({ messageId, userId }) => {
      try {
        const existed = await DeletedMessage.findOne({ messageId, userId });
        if (!existed) {
          await DeletedMessage.create({ messageId, userId });
        }
        socket.emit('message_deleted_local', { messageId });
      } catch (error) {
        console.error('Error deleting message locally:', error);
        socket.emit('delete_local_error', { error: 'Xóa tin nhắn thất bại' });
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


    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}

export default socketServer
