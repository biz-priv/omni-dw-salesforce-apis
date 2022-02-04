const AWS = require('aws-sdk');
const ssm = new AWS.SSM();

AWS.config.update({ region: 'us-east-1' });

async function getLatestTimestampFromSSM(timestamp) {
    try {
        let ssmOptions = {
            Name: process.env.TIMESTAMP_SSM_PARAMETER,
            WithDecryption: false
        };
        timestamp = await ssm.getParameter(ssmOptions).promise();
        return timestamp;
    } catch (error) {
        console.info("Get Timestamp Error : \n", error);
        return error ;
    }
}

async function updateLatestTimestampToSSM(timestamp) {
    try {
        var params = {
            Name: process.env.TIMESTAMP_SSM_PARAMETER,
            Value: timestamp,
            Overwrite: true,
            Type: 'String'
        };
        let updateTimestamp = await ssm.putParameter(params).promise();
        return true;
    } catch (error) {
        console.error("Put Timestamp Error : \n", error);
        return error ;
    }
}


module.exports = { getLatestTimestampFromSSM , updateLatestTimestampToSSM}