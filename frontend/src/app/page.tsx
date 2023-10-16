'use client'
import axios from 'axios';
import React, { useState } from 'react'

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileMimeType, setFileMimeType] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [fileParts, setFileParts] = useState<Array<ArrayBuffer>>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);


  const fileChangedHandler = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if(event.target.files && event.target.files[0]){
        const {files} = event.target;
        let selectedFile = files[0]
        setSelectedFile(selectedFile);
        setFileName(selectedFile.name);
        setFileMimeType(selectedFile.type);

        // Calculate the total number of parts needed to split the file
        const totalParts = Math.ceil(selectedFile.size / (15 * 1024 * 1024)); // 15MB in bytes

        const promises: Promise<ArrayBuffer>[] = [];

        for (let i = 0; i < totalParts; i++) {
          const start = i * (15 * 1024 * 1024);
          const end = Math.min(start + (15 * 1024 * 1024), selectedFile.size);
          const blob = selectedFile.slice(start, end);

          promises.push(blobToArrayBuffer(blob));
        }

        // Wait for all the promises to resolve
        const partArrays = await Promise.all(promises);

        // Now, partArrays will contain the parts of the file as ArrayBuffer
        setFileParts(partArrays);
      }else{
        setSelectedFile(null);
        setFileName('');
        setFileMimeType('');
        setProgress(0);
        setFileParts([]);
      }
    } catch (err) {
      console.error(err)
    }
  }

  const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        }
      };

      reader.readAsArrayBuffer(blob);
    });
  };

  const processUpload = async () => {
    try {
      setIsProcessing(true);

      const startUpload = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL}/start-upload`, {
        filename: fileName,
        mimetype: fileMimeType
      })

      const { uploadId, uploadKey } = startUpload.data;

      const promisesArray = []

      for (let i = 0; i < fileParts.length; i++) {
        const blob = fileParts[i];
        const parts = i + 1;
        const getUploadUrlResp = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL}/get-signed-url`, {
          uploadKey: uploadKey,
          uploadId: uploadId,
          partNumber: i + 1
        });

        let presignedUrl = getUploadUrlResp.data

        // (2) Puts each file part into the storage server
        let uploadResp = axios.put(
          presignedUrl,
          blob,
          { headers: { 'Content-Type': fileMimeType } }
        )

        setProgress(Math.round((parts / fileParts.length) * 100));
        promisesArray.push(uploadResp)
      }

      let resolvedArray = await Promise.all(promisesArray)
      
      
      let uploadPartsArray: {
        ETag: string,
        PartNumber: number
      }[] = []

      resolvedArray.forEach((resolvedPromise, index) => {
        uploadPartsArray.push({
          ETag: resolvedPromise.headers['etag'],
          PartNumber: index + 1
        })
      })

      const completeUpload = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL}/complete-upload`, {
        uploadId: uploadId,
        multipartUpload: {
          Parts: uploadPartsArray
        },
        uploadKey: uploadKey,
      })

      setIsProcessing(false);
      console.log(completeUpload.data);

    } catch (error) {
      setIsProcessing(false);
      console.log(error);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-gray-200">
      <div className="w-full">
        <div className='w-full bg-gray-600 p-2 rounded-md'>
          <input type='file' id="file" onChange={fileChangedHandler} />
        </div>
        { isProcessing && 
          <div className='w-full bg-gray-600 p-2 rounded-md my-4'>
            <div className="bg-white text-xs font-medium text-blue-900 text-center p-0.5 leading-none rounded-full" style={{
              width: `${progress}%`
            }}> { `${progress}%` }</div>
          </div>
        }
        { fileParts.length > 0 &&
          <>
            <div className='w-full bg-gray-600 p-2 rounded-md my-4'>
              <ul className="w-1/2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg">
              {
                fileParts.map((part, index) => (
                  <li className="w-full px-4 py-2 border-b border-gray-200 flex items-center justify-between" key={index}>
                    <span>Part {index + 1}</span>
                    <span>{part.byteLength} bytes</span>
                  </li>
                ))
              }
              </ul>
            </div>
             <div className='w-full p-2'>
             {!isProcessing ?
                <button type="button" className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800" onClick={processUpload}>
                  Process
                </button>
              :
              <div role="status">
                  <svg aria-hidden="true" className="inline w-8 h-8 mr-2 text-gray-200 animate-spin dark:text-gray-600 fill-green-500" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
                      <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
                  </svg>
                  <span className="sr-only">Loading...</span>
              </div>
             }
            </div>
          </>
        }
      </div>
    </main>
  )
}
