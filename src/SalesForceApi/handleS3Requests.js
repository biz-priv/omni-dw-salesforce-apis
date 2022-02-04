const AWS = require("aws-sdk");
const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
var XLSX = require('xlsx');
const { csvToJSON } = require("../shared/utils/utils");

async function startXlsxS3Process(s3BucketName, requestData) {
    let chunkSize = 300;
    for (var i = 0, len = requestData.length; i < len; i += chunkSize) {
        let dataToUpload = requestData.slice(i, i + chunkSize);
        console.info("i = " + i + ", length =" + dataToUpload.length + ", Total Size = " + requestData.length);
        const sheetDataBuffer = await prepareSpreadsheet(dataToUpload);
        await uploadFileToS3(s3BucketName, sheetDataBuffer)
    }
}

async function uploadFileToS3(s3BucketName, sheetDataBuffer) {
  try {
            // const bufferObject = new Buffer.from(requestData);
            let date = new Date()
            date = date.toISOString()
            date = date.replace(/:/g, '-')
            const params = {
                Bucket: s3BucketName,
                Key: `liveData/${date}.csv`,
                Body: sheetDataBuffer,
                ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                ContentEncoding: 'base64',
                ACL: 'private'
            };

            return new Promise((resolve, reject) => {
                s3.upload(params, function (err, data) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(data.Location);
                });
            });
        } catch (error) {
            return error
        }
}

async function prepareSpreadsheet(requestData) {
    const wb = XLSX.utils.book_new();

    //Convert JSON to sheet data
    const sheetData = XLSX.utils.json_to_sheet(requestData);

    XLSX.utils.book_append_sheet(wb, sheetData, 'Sheet 1');
    const sheetDataBuffer = await XLSX.write(wb, { bookType: 'csv', type: 'buffer', bookSST: false });
    return sheetDataBuffer;
}

async function fetchAllKeysFromS3(s3BucketName,token){
    var allKeys = [];
  var opts = { Bucket: s3BucketName,Prefix: 'liveData/' };
  if(token) opts.ContinuationToken = token;
  return new Promise((resolve, reject) => {
  s3.listObjectsV2(opts, function(err, data){
    allKeys = allKeys.concat(data.Contents);
    if(data.IsTruncated)
      fetchAllKeysFromS3(s3BucketName,data.NextContinuationToken);
    else
    {
      resolve(allKeys);
    }
  });
});
}

async function moveS3ObjectToArchive(s3BucketName,fileName) {
    return new Promise((resolve, reject) => {
    var params = {
        Bucket: s3BucketName,
        CopySource: s3BucketName + '/' + fileName,
        Key: fileName.replace('liveData/','archive/')
      };
    s3.copyObject(params, function(copyErr, copyData){
        if (copyErr) {
          console.log(copyErr);
          resolve(copyErr);
        }
        else {
          console.log('Copied: ', params.Key);
          try{
          s3.deleteObject({
          Bucket: s3BucketName,
          Key: fileName,
        }).promise();
          }
          catch(deleteError){
            console.error(deleteError);
          }
        resolve("completed");
        }
      });
    });
}
async function readS3Object(s3BucketName,fileName) {
    try {
      let getParams = {
        Bucket: s3BucketName, 
        Key: fileName
      }
    //   console.info('Get params filename : \n',fileName['Key'])
    const stream = s3.getObject(getParams).createReadStream().on('error', error => {
        return error
      });
    //   console.info(stream);
    //   console.info("Executing csv To Json")
      const data = await csvToJSON(stream);
      return data;
    } catch (error) {
      console.error(error);
      return error.message;
    }
  }
module.exports = { startXlsxS3Process, fetchAllKeysFromS3, moveS3ObjectToArchive, readS3Object}