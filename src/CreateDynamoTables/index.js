const AWS = require("aws-sdk");
const dynamo = require('dynamodb');
const Joi = require('joi');
const { send_response } = require("../shared/utils/responses");
const region = process.env.DEFAULT_AWS;

dynamo.AWS.config.update({ region: region });

const salesforceParentAccountRecord = dynamo.define('salesforce_parent_account_record', {
    hashKey: 'req_Name',
    timestamps: true,
    schema: {
        Id: dynamo.types.uuid(),
        req_Name: Joi.string(),
        createdAt: Joi.string(),
    }
});

const salesforceChildAccountRecord = dynamo.define('salesforce_child_accounts_record', {
    hashKey: 'req_Name',
    timestamps: true,
    schema: {
        Id: dynamo.types.uuid(),
        req_Name: Joi.string(),
        createdAt: Joi.string(),
    },
});

const salesForecastRecord = dynamo.define('sales_forecast_record', {
    hashKey: 'req_Name',
    timestamps: true,
    schema: {
        Id: dynamo.types.uuid(),
        req_Name: Joi.string(),
        createdAt: Joi.string(),
    }
});

module.exports.handler = async (event) => {
  return new Promise((resolve, reject) => {
    dynamo.createTables(function (err) {
      if (err) {
        console.error(err);
        reject(err);
      } else {
        console.info('Tables has been created');
        let tables = 'Tables has been created';
        resolve(tables);
      }
    });
  });
};

