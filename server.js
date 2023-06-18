const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const app = express();
const storage = multer.memoryStorage();
const upload = multer({
    limits: { fieldSize: 25 * 1024 * 1024 },
    storage
  });


var faceIdVsName = {
    "f81cfe6d-3872-4a1d-ad85-abdaeba1a93f": "Richa",
    "af4ef5b4-626c-4c11-8fe4-c0043f5de2db": "Mausi",
    "1e4d3b35-33d3-4fb2-9587-f9ec0b45b07d": "Mummy"
}

// Configure AWS credentials and S3 bucket
AWS.config.update({
  accessKeyId: 'AKIA2BQLVEVQOYBF7U4Q',
  secretAccessKey: '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',
  region: 'ap-south-1',
});
const s3 = new AWS.S3();
const rekognition = new AWS.Rekognition();
const bucketName = 'himfacereco';

app.use(express.json())

app.post('/upload', (req, res) => {
    // Base64-encoded image data from the request body
    const base64Image = req.body.image;
    
    // Decode the base64 image data
    const imageBuffer = Buffer.from(base64Image, 'base64');
    
    // Generate a unique filename for the image
    const filename = `image_${Date.now()}.jpg`;
    
    // Specify the S3 bucket name and desired key for the image
    const bucketName = 'YOUR_S3_BUCKET_NAME';
    const key = `images/${filename}`;
    
    // Create a params object for the S3 upload operation
    const params = {
        Bucket: bucketName,
        Key: key,
        Body: imageBuffer,
        ContentType: 'image/jpeg',
        ACL: 'public-read', // Set the desired ACL permissions for the uploaded image
    };
    s3.upload(params, async (err, data) => {
      if (err) {
        console.log(4);
        console.error(err);
        res.status(500).send('Failed to upload file to S3.');
      } else {
        // File uploaded successfully to S3
        console.log(3);
        let response = await searchFacesByImage("himfacereco", params.Key);
        res.send({ "image" : faceIdVsName[getImageId(response)]});
      }
    });
  });

app.post('/uploads', upload.single('image'), (req, res) => {
  const file = req.image;
  if (!file) {
    console.log(16);
    res.status(400).send('No file uploaded.');
    return;
  }
  console.log(1);
  const params = {
    Bucket: bucketName,
    Key: file.originalname,
    Body: file.buffer,
  };
  console.log(2);
  s3.upload(params, async (err, data) => {
    if (err) {
      console.log(4);
      console.error(err);
      res.status(500).send('Failed to upload file to S3.');
    } else {
      // File uploaded successfully to S3
      console.log(3);
      let response = await searchFacesByImage("himfacereco", params.Key);
      res.send({ "image" : faceIdVsName[getImageId(response)]});
    }
  });
});

function getImageId(faceObj) {
    let faceId = faceObj.FaceMatches;
    if(!Array.isArray(faceId) || (faceId.length == 0)) {
        return "";
    }
    return faceId[0].Face.FaceId;
}

async function searchFacesByImage(bucketName, imageName) {
  try {
    const params = {
      CollectionId: 'img-collection',
      Image: {
        S3Object: {
          Bucket: bucketName,
          Name: imageName,
        },
      },
    };

    const response = await rekognition.searchFacesByImage(params).promise();
    return response;
  } catch (error) {
    console.error("Error", error);
  }
}

app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
