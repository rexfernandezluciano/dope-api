
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name',
  api_key: '552259847565352',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'your-api-secret'
});

export default cloudinary;
