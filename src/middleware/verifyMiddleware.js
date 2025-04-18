import jwt from "jsonwebtoken"
import dotenv from 'dotenv'
dotenv.config()

const verifyToken = (req, res, next) => {
  // const token = req.headers.authorization?.split(" ")[1];
  // if (!token) return res.status(401).json({ message: "Bạn chưa đăng nhập!" });

  // jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
  //   if (err) return res.status(403).json({ message: "Token không hợp lệ!" });

  //   req.user = user;
  //   next()
  // })


  const token = req.headers.authorization
  console.log("token: ", token);
  
  if(token) {
    const accessToken = token.split(" ")[1];
    jwt.verify(accessToken, process.env.SECRET_KEY, (err, user) => {
      if(err) {
        return res.status(403).json("Token is not valid")
      }

      req.user = user
      next()
    })
  } else {
    res.status(401).json("Vui lòng đăng nhập")
  }
}


export default verifyToken
