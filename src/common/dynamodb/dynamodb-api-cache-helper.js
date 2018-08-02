const aws = require('aws-sdk');

module.exports = {
    getCache, putCache
};

function getCache() {
    return new Promise(function (resolve, reject) {
        let ddb = new aws.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
        let params = {
            TableName: "NMZL_US_API_CACHE",
            Key: {
                'CACHE_KEY': process.env['API_RESPONSE_CACHE_KEY']
            }
        };

        console.log('getCache: Getting item from DynamoDB table NMZL_US_API_CACHE');
        ddb.get(params, function (err, data) {
            if (err) {
                reject(Error('Error fetching cache data from DynamoDB; Error info: ' + err));
            } else {
                if (data.Item && data.Item.RESPONSE && data.Item.TTL > Math.floor((Date.now() / 1000))) {
                    resolve(data.Item.RESPONSE);
                }
                else {
                    resolve(null);
                }
            }
        });
    });
}

function putCache(response) {
    return new Promise(function (resolve, reject) {
        let ddb = new aws.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
        let expirationTime = Math.floor((Date.now() / 1000)) + parseInt(process.env['CACHE_TTL']);
        console.log('Cache expiration time: ' + expirationTime);
        let params = {
            TableName: "NMZL_US_API_CACHE",
            Item: {
                'CACHE_KEY': process.env['API_RESPONSE_CACHE_KEY'],
                'RESPONSE': JSON.stringify(response),
                'TTL': expirationTime
            }
        };

        console.log('putCache: Putting response into DynamoDB table NMZL_US_API_CACHE');
        ddb.put(params, function (err) {
            if (err) {
                reject(Error('Error putting cache data from DynamoDB; Error info: ' + err));
            } else {
                resolve(response);
            }
        });
    });
}