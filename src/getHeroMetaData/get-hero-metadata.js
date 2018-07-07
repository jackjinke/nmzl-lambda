const dynamodbHelper = require('dynamodb-helper');
const responseHelper = require('response-helper');

exports.handler = (event, context, callback) => {
    dynamodbHelper.ApiCache.getCache().then((response) => {
        // Found valid cache
        if (response) {
            console.log('Found valid response cache, returning cache: ' + response);
            responseHelper.returnSuccess(JSON.parse(response), callback);
            return;
        }

        // No valid cache found
        console.log('No valid cache found, generating new response');
        return dynamodbHelper.HeroMetadata.getAllHeroMetadata();
    }).then((response) => {
        dynamodbHelper.ApiCache.putCache(response).then(() => {
            responseHelper.returnSuccess(response, callback);
        }).catch((e) => {
            console.warn(e);
            responseHelper.returnSuccess(response, callback);
        });
    }).catch((error) => {
        responseHelper.returnError(error, callback);
    });
};