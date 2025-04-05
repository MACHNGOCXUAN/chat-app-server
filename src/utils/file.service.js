import { awsConfig } from "../configs/awsConfig.js"
import dotenv from 'dotenv'

dotenv.config()

const randomString = (num) => {
  return `${Math.random().toString(36).substring(2, num +2)}`
}

const FILE_TYPE_MATCH = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  "video/mp3",
  "video/mp4",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.rar",
  "application/zip"
]

const uploadFile = async (file) => {

  console.log(file);
  
  const filePath = `${randomString(4)}-${new Date().getTime()}-${file?.originalname}`

  if(FILE_TYPE_MATCH.indexOf(file.mimetype) == -1){
    throw new Error(`${file?.originalname} is invalid`)
  }

  const uploadParams = {
    Bucket: process.env.BUCKET_NAME,
    Body: file?.buffer,
    Key: filePath,
    ContentType: file?.mimetype
  }

  try {
    const data = await awsConfig.s3.upload(uploadParams).promise()
    console.log(`file upload sucessfully: ${data.Location}`)
    const fileName = `${data.Location}`
    return fileName
  } catch (error) {
    console.error("Error uploading file to AWS S3: ", error)
    throw new Error("Upload file to AWS S3 failed")
  }
}


export default uploadFile