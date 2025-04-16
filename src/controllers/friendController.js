import userModel from "../models/userModel.js"

const addFriend = async (req, res) => {
  const { senderPhone, receiverPhone  } = req.body
  try {
    const sender = await userModel.findOne({phoneNumber: senderPhone})
    const receiver = await userModel.findOne({ phoneNumber: receiverPhone })

    if(!sender || !receiver) {
      return res.status(404).json({ message: 'Người gửi hoặc người nhận không tồn tại.' })
    }

    const senderId = sender._id.toString()
    const receiverId = receiver._id.toString()

    const alreadyRequested = receiver.friends.some(
      f => f.friendId.toString() === senderId && f.status === 'pending'
    )

    if (alreadyRequested) {
      return res.status(400).json({ message: 'Đã gửi lời mời kết bạn.' })
    }

    receiver.friends.push({ friendId: senderId, status: 'pending' })

    await receiver.save();

    global._io.to(receiverId).emit("friendRequestReceived", {
      from: senderId,
      username: sender.username
    })

    res.status(200).json({ message: 'Đã gửi lời mời kết bạn.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server. Vui lòng thử lại sau!' });
  }
}


const acceptFriend = async (req, res) => {
  const { senderPhone, receiverPhone  } = req.body
  try {
    const sender = await userModel.findOne({phoneNumber: senderPhone})
    const receiver = await userModel.findOne({ phoneNumber: receiverPhone })

    if (!sender || !receiver) {
      return res.status(404).json({ message: 'Người dùng không tồn tại.' });
    }

    const senderId = sender._id.toString()
    const receiverId = receiver._id.toString()

    receiver.friends.forEach(f => {
      if (f.friendId.toString() === senderId && f.status === 'pending') {
        f.status = 'accepted';
      }
    })

    sender.friends.push({ friendId: receiverId, status: 'accepted' })

    await sender.save()
    await receiver.save() 

    global._io.to(senderId).emit('friendRequestAccepted', {
      from: receiverId,
      username: receiver.username
    })

    res.status(200).json({ message: 'Đã chấp nhận kết bạn.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server. Vui lòng thử lại sau!' });
  }
}

// Lấy danh sách bạn bè đã gửi và đã là bạn bè
const getFriendsByUser = async (req, res) => {
  const userId = req.user._id;

  try {
    const user = await userModel.findById(userId).populate({
      path: "friends.friendId",
      select: "username avatarURL phoneNumber email"
    });

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại." });
    }
    const acceptedFriends = [];
    const pendingRequests = [];

    user.friends.forEach(friend => {
      if (!friend.friendId) return;

      const friendData = {
        _id: friend.friendId._id,
        username: friend.friendId.username,
        avatarURL: friend.friendId.avatarURL,
        phoneNumber: friend.friendId.phoneNumber,
        email: friend.friendId.email
      };

      if (friend.status === "accepted") {
        acceptedFriends.push(friendData);
      } else if (friend.status === "pending") {
        pendingRequests.push(friendData);
      }
    });

    res.status(200).json({
      acceptedFriends,
      pendingRequests
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bạn bè:", error);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại sau!" });
  }
};

export default getFriendsByUser;


export const friendController = {
  addFriend,
  acceptFriend,
  getFriendsByUser
}