import AWS from 'aws-sdk'
import dotenv from 'dotenv'
dotenv.config()

const config = new AWS.Config({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
})

AWS.config = config

const s3 = new AWS.S3()
const dynamoDB = new AWS.DynamoDB.DocumentClient()

export const awsConfig = {
  s3,
  dynamoDB
}