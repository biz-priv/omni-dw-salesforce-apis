const AWS = require("aws-sdk");

/* insert record in table */
async function itemInsert(tableName, record) {
  let documentClient = new AWS.DynamoDB.DocumentClient({
    region: process.env.DEFAULT_AWS,
  });
  
  let params = {
    RequestItems: {
      [`${tableName}`] : record
    }
  }
  // console.info(params)
  try {
    return await documentClient.batchWrite(params).promise();
  } catch (e) {
    console.error("itemInsert Error: ", e);
    return e;
  }
}

module.exports = { itemInsert }