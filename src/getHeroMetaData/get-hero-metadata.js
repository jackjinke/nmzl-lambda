const dynamodbHelper = require('dynamodb-helper');
const responseHelper = require('response-helper');

exports.handler = (event, context, callback) => {
    dynamodbHelper.getCache().then((response) => {
        // Found valid cache
        if (response) {
            console.log('Found valid response cache, returning cache: ' + response);
            responseHelper.returnSuccess(JSON.parse(response), callback);
            return;
        }

        // No valid cache found
        console.log('No valid cache found, generating new response');
        return dynamodbHelper.getAllHeroMetadata();
    }).then((response) => {
        dynamodbHelper.putCache(response).then(() => {
            responseHelper.returnSuccess(response, callback);
        }).catch((e) => {
            console.warn(e);
            responseHelper.returnSuccess(response, callback);
        });
    }).catch((error) => {
        responseHelper.returnError(error, callback);
    });
};