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
  console.info(JSON.stringify(params))
  try {
    return await documentClient.batchWrite(params).promise();
  } catch (e) {
    console.error("itemInsert Error: ", e);
    return e;
  }
}


async function dbRead(params) {
  try {
    const documentClient = new AWS.DynamoDB.DocumentClient({
      region: process.env.DEFAULT_AWS,
    });
    let result = await documentClient.scan(params).promise();
    let data = result.Items;
    if (result.LastEvaluatedKey) {
      params.ExclusiveStartKey = result.LastEvaluatedKey;
      data = data.concat(await dbRead(params));
    }
    console.log(`DynamoDb ${params['TableName']} Data`, data.length)
    return data;
  } catch (error) {
    console.info("Error",error);
    return error;
  }
}

/* retrieve all items from table */
async function scanTableData(tableName) {
  let params = {
    TableName: tableName,
    FilterExpression: 'api_insert_Status = :status',
    ExpressionAttributeValues: { ':status': false },
  };

  let data = await dbRead(params);
  return data;
}

module.exports = { itemInsert,scanTableData }