import userModel from "../models/userModel"

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

    sender.friends.push({ friendId: receiverId, status: 'pending' })
    receiver.friends.push({ friendId: senderId, status: 'pending' })

    await sender.save();
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

    sender.friends.forEach(f => {
      if (f.friendId.toString() === receiverId && f.status === 'pending') {
        f.status = 'accepted';
      }
    })

    receiver.friends.forEach(f => {
      if (f.friendId.toString() === senderId && f.status === 'pending') {
        f.status = 'accepted';
      }
    })

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

export const friendController = {
  addFriend,
  acceptFriend
}