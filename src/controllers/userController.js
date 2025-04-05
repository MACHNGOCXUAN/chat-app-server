
import uploadFile from '../utils/file.service.js'
import userModel from '../models/userModel.js'
import bcryptjs from 'bcryptjs'

const register = async (req, res) => {

  const { username, phoneNumber, dateOfBirth, gender, password, email } = req.body
  try {
    const existingUser = await userModel.findOne({ 
      $or: [{ email }, { phoneNumber }] 
    });

    if (existingUser) {
      return res.status(409).json({ 
        error: 'Số điện thoại hoặc email đã tồn tại' 
      });
    }

    const salt = await bcryptjs.genSalt(10)
    const hashpassword = await bcryptjs.hash(password,salt)

    const avatar = await uploadFile(req.file)
    const newUser = new userModel({
      username, 
      phoneNumber,
      avatarURL: avatar,
      dateOfBirth,
      gender,
      password: hashpassword,
      email,
    })

    await newUser.save()

    const userResponse = {
      _id: newUser._id,
      username: newUser.username,
      phoneNumber: newUser.phoneNumber,
      avatarURL: newUser.avatarURL,
      status: newUser.status,
      createdAt: newUser.createdAt
    };

    res.status(201).json({message: "Đăng ký thành công", user: userResponse});
  } catch (error) {
    res.status(500).json(error)
  }
}


const login = async (req, res) => {
  try {
    
  } catch (error) {
    res.status(500).json(error)
  }
}


export const userController = {
  register
}