import express, {Express, Request, Response} from 'express';
import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, ListMultipartUploadsCommand, S3Client, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';



require('dotenv').config()

const app: Express = express();
const port = process.env.APP_PORT;

app.use(express.json());

app.use(
  cors({
    origin: [
      'http://localhost:3001',
    ]
  }),
);

function getFileExtension(filename: string): string | undefined {
  const ext = filename.split('.').pop();

  if (filename === ext || !ext) {
    return undefined;
  }

  return ext;
}



const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  region: process.env.S3_REGION
})

app.get('/', (req: Request, res: Response)=>{
    const { key } = req.query
    res.send(`Hello, this is Express + TypeScript ${key}`);
});

app.get('/get-multipart', async (req: Request, res: Response)=>{
    try {
      const param = {
        Bucket: process.env.S3_BUCKET,
      }
      
      const command = new ListMultipartUploadsCommand(param);
      const result = await s3.send(command);

      res.status(200).send(result);
    } catch (error) {
      console.log(error)
      res.status(500).send('Failed to generate multipart')
    }
});

app.post('/start-upload', async (req: Request, res: Response)=>{
    try {
      const {filename, mimetype} = req.body;

      const newFileName = `${uuidv4()}.${getFileExtension(filename)}`;

      const param = {
        ACL: "public-read",
        Bucket: process.env.S3_BUCKET,
        Key: newFileName,
        ContentType: mimetype,
      }
      
      const command = new CreateMultipartUploadCommand(param);
      const result = await s3.send(command);

      res.status(200).send({
        uploadKey: newFileName,
        uploadId: result.UploadId
      });
    } catch (error) {
      console.log(error)
      res.status(500).send('Failed to generate multipart')
    }
});

app.post('/get-signed-url', async (req, res, next) => {
	try {
      const {uploadKey, uploadId, partNumber} = req.body;

		let params = {
			Bucket:process.env.S3_BUCKET || '',
      Key: uploadKey,
      PartNumber: partNumber,
      UploadId: uploadId
		}

    const command = new UploadPartCommand(params);
    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 3600 // The number of seconds before the presigned URL expires
    });

		res.status(200).send(signedUrl)
	} catch(err) {
		console.log(err)
	}
})

app.post('/complete-upload', async (req: Request, res: Response)=>{
    try {
      const {uploadKey, uploadId, multipartUpload} = req.body;

      const param = {
        Bucket: process.env.S3_BUCKET || '',
        Key: uploadKey,
        MultipartUpload: multipartUpload,
        UploadId: uploadId
      }

      console.log(param);
      
      const command = new CompleteMultipartUploadCommand(param);
      const result = await s3.send(command);

      res.status(200).send(result);
    } catch (error) {
      console.log(error)
      res.status(500).send('Failed to generate multipart')
    }
});

app.post('/cancel-upload', async (req: Request, res: Response)=>{
    try {
      const {uploadKey, uploadId} = req.body;

      const param = {
        Bucket: process.env.S3_BUCKET,
        Key: uploadKey,
        UploadId: uploadId,
      }
      
      const command = new AbortMultipartUploadCommand(param);
      const result = await s3.send(command);

      res.status(200).send(result);


    } catch (error) {
      console.log(error)
      res.status(500).send('Failed to generate multipart')
    }
});

app.listen(port, ()=> {
  console.log(`[Server]: I am running at https://localhost:${port}`);
});