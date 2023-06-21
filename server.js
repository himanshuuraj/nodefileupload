const express = require('express');
const multer = require('multer');
const fs = require('fs');
const AWS = require('aws-sdk');
const app = express();
const storage = multer.memoryStorage();
const upload = multer({
    limits: { fieldSize: 25 * 1024 * 1024 },
    storage
  });

var filePath = "metdata-file.json";
var faceIdVsName = {}

// Configure AWS credentials and S3 bucket
AWS.config.update({
  accessKeyId: 'AKIA2BQLVEVQOYBF7U4Q',
  secretAccessKey: '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',
  region: 'ap-south-1',
});
const s3 = new AWS.S3();
const rekognition = new AWS.Rekognition();
const bucketName = 'himfacereco';
const collectionId = 'img-collection';

app.use(express.json())

app.get('/', (req, res) => {
  res.send({ "response" : "working fine"});
});

// Define the route to handle file upload
app.post('/insert/:userId', upload.single("image"), async (req, res) => {
  try {

    // Read the uploaded file from memory buffer
    const imageBytes = req.file.buffer;
    const userUid = req.params.userId;
    console.log(userUid);

    // Define the collection ID

    // Call the function to add a face to the collection
    await addFaceToCollection(collectionId, imageBytes, userUid);

    res.status(200).json({ message: userUid });
  } catch (error) {
    console.error('An error occurred:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to add a face to an AWS Rekognition collection
async function addFaceToCollection(collectionId, imageBytes, userUid) {
  try {
    const params = {
      CollectionId: collectionId,
      Image: {
        Bytes: imageBytes
      },
      ExternalImageId: new Date().getTime().toString() // Provide a unique identifier for the face
    };

    let res = await rekognition.indexFaces(params).promise();
    
    console.log('Res index faces', res);
    let faceId = res.FaceRecords[0].Face.FaceId;
    faceIdVsName[faceId] = userUid;
    writeIntoFile();
    console.log('Face added to collection successfully.');
  } catch (error) {
    console.error('Error adding face to collection:', error.message);
    throw error;
  }
}

app.post('/uploads', upload.single('image'), (req, res) => {
  const file = req.file;
  if (!file) {
    console.log(16);
    res.status(400).send('No file uploaded.');
    return;
  }
  const params = {
    Bucket: bucketName,
    Key: file.originalname,
    Body: file.buffer,
  };
  s3.upload(params, async (err, data) => {
    if (err) {
      console.log(4);
      console.error(err);
      res.status(500).send('Failed to upload file to S3.');
    } else {
      // File uploaded successfully to S3
      let response = await searchFacesByImage(bucketName, params.Key);
      console.log(response);
      res.send({ "image" : faceIdVsName[getImageId(response)]});
    }
  });
});

function getImageId(faceObj) {
  if(!faceObj) return "";
    let faceId = faceObj.FaceMatches;
    if(!Array.isArray(faceId) || (faceId.length == 0)) {
        return "";
    }
    return faceId[0]?.Face?.FaceId || "";
}

async function searchFacesByImage(bucketName, imageName) {
  try {
    const params = {
      CollectionId: collectionId,
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

function writeIntoFile() {
  fs.writeFile(filePath, JSON.stringify(faceIdVsName), (err) => {
    if (err) {
      console.error('An error occurred:', err);
    } else {
      console.log('JSON data inserted into file successfully.');
    }
  });
}

function readFromFile() {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('An error occurred:', err);
    } else {
      try {
        // Parse the JSON data
        const jsonData = JSON.parse(data);
        faceIdVsName = jsonData;
        // Process the JSON data or perform further operations
        console.log('JSON data:', jsonData);
      } catch (error) {
        console.error('Error parsing JSON:', error);
      }
    }
  });
}

readFromFile();

app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
