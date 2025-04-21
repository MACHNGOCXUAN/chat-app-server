import conversationModel from "../models/conversationModel.js";
import userModel from "../models/userModel.js";

const addFriend = async (req, res) => {
  const { senderPhone, receiverPhone } = req.body;
  try {
    const sender = await userModel.findOne({ phoneNumber: senderPhone });
    const receiver = await userModel.findOne({ phoneNumber: receiverPhone });

    if (!sender || !receiver) {
      return res
        .status(404)
        .json({ message: "Người gửi hoặc người nhận không tồn tại." });
    }

    const senderId = sender._id.toString();
    const receiverId = receiver._id.toString();

    const alreadyRequested = receiver.friends.some(
      (f) => f.friendId.toString() === senderId && f.status === "pending"
    );

    if (alreadyRequested) {
      return res.status(400).json({ message: "Đã gửi lời mời kết bạn." });
    }

    receiver.friends.push({ friendId: senderId, status: "pending" });

    await receiver.save();

    global._io.to(receiverId).emit("friendRequestReceived", {
      from: senderId,
      username: sender.username,
    });

    res.status(200).json({ success: true, message: "Đã gửi lời mời kết bạn." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại sau!" });
  }
};

const acceptFriend = async (req, res) => {
  const { senderPhone, receiverPhone } = req.body;

  try {
    const [sender, receiver] = await Promise.all([
      userModel.findOne({ phoneNumber: senderPhone }).session(session),
      userModel.findOne({ phoneNumber: receiverPhone }).session(session),
    ]);

    if (!sender || !receiver) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Người dùng không tồn tại." });
    }

    const senderId = sender._id.toString();
    const receiverId = receiver._id.toString();

    const receiverFriendIndex = receiver.friends.findIndex(
      (f) => f.friendId.toString() === senderId && f.status === "pending"
    );

    if (receiverFriendIndex === -1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Không tìm thấy lời mời kết bạn." });
    }

    const alreadyFriends = sender.friends.some(
      (f) => f.friendId.toString() === receiverId && f.status === "accepted"
    );

    if (alreadyFriends) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Đã là bạn bè từ trước." });
    }

    receiver.friends[receiverFriendIndex].status = "accepted";
    await receiver.save({ session });

    // Thêm bạn bè vào sender
    sender.friends.push({ friendId: receiverId, status: "accepted" });
    await sender.save({ session });

    // Tạo conversation
    const newConversation = {
      name: `${sender._id} - ${receiver._id}`,
      members: [
        { userId: sender._id, role: "member" },
        { userId: receiver._id, role: "member" }
      ],
      type: 'private'
    };

    const conversation = await conversationModel.create(newConversation);

    const emitData = {
      friendId: senderId,
      username: sender.username,
      avatarURL: sender.avatarURL,
      conversation
    };

    global._io.to(senderId.toString()).emit("friend_request_accepted", {
      ...emitData,
      friendId: receiverId,
      username: receiver.username,
      avatarURL: receiver.avatarURL
    });

    global._io.to(receiverId.toString()).emit("friend_request_accepted", emitData);


    res.status(200).json({ success: true, message: "Đã chấp nhận kết bạn." });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error accepting friend request:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau!",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Lấy danh sách bạn bè đã gửi và đã là bạn bè
const getFriendsByUser = async (req, res) => {
  const userId = req.user._id;

  try {
    const user = await userModel.findById(userId).populate({
      path: "friends.friendId",
      select: "username avatarURL phoneNumber email",
    });

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại." });
    }
    const acceptedFriends = [];
    const pendingRequests = [];

    user.friends.forEach((friend) => {
      if (!friend.friendId) return;

      const friendData = {
        _id: friend.friendId._id,
        username: friend.friendId.username,
        avatarURL: friend.friendId.avatarURL,
        phoneNumber: friend.friendId.phoneNumber,
        email: friend.friendId.email,
      };

      if (friend.status === "accepted") {
        acceptedFriends.push(friendData);
      } else if (friend.status === "pending") {
        pendingRequests.push(friendData);
      }
    });

    res.status(200).json({
      acceptedFriends,
      pendingRequests,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bạn bè:", error);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại sau!" });
  }
};


// =================== Từ chối lởi mời kết bạn ============================
const rejectFriendRequest = async (req, res) => {
  const { phoneNumber } = req.body;
  
  try {
    const currentUser = await userModel.findById(req.user._id);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "Người dùng không tồn tại" });
    }

    const requestUser = await userModel.findOne({ phoneNumber });
    if (!requestUser) {
      return res.status(404).json({ success: false, message: "Người gửi lời mời không tồn tại" });
    }

    const friendRequestIndex = currentUser.friends.findIndex(
      f => f.friendId.equals(requestUser._id) && f.status === "pending"
    );

    if (friendRequestIndex === -1) {
      return res.status(400).json({ 
        success: false, 
        message: "Không tìm thấy lời mời kết bạn từ người này" 
      });
    }

    currentUser.friends.splice(friendRequestIndex, 1);
    await currentUser.save();

    if (global._io) {
      global._io.to(requestUser._id.toString()).emit("friend_request_rejected", currentUser);
    }

    res.status(200).json({ 
      success: true, 
      message: "Đã từ chối lời mời kết bạn thành công" 
    });

  } catch (error) {
    console.error("Lỗi khi lấy danh sách bạn bè:", error);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại sau!" });
  }
};

export const friendController = {
  addFriend,
  acceptFriend,
  getFriendsByUser,
  rejectFriendRequest
};
