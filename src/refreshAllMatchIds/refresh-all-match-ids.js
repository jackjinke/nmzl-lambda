const https = require('https');
const dynamodbHelper = require('dynamodb-helper');

exports.handler = async (event, context) => {
    let allMatchIds = await dynamodbHelper.Matches.getAllMatchIds();
    let overrideKey = (event.overrideKey) ? event.overrideKey : null;
    let overrideTTL = (event.overrideTTL) ? event.overrideTTL : null;
    return await dynamodbHelper.ApiCache.putCache(allMatchIds, overrideKey, overrideTTL);
};