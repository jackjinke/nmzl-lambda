const aws = require('aws-sdk');

module.exports = {
    getCache, putCache
};

function getCache() {
    return new Promise(function (resolve, reject) {
        let ddb = new aws.DynamoDB({apiVersion: '2012-08-10'});
        let params = {
            TableName: "NMZL_US_API_CACHE",
            Key: {
                'CACHE_KEY': {
                    S: process.env['API_RESPONSE_CACHE_KEY']
                }
            }
        };

        console.log('getCache: Getting item from DynamoDB table NMZL_US_API_CACHE');
        ddb.getItem(params, function (err, data) {
            if (err) {
                reject(Error('Error fetching cache data from DynamoDB; Error info: ' + err));
            } else {
                if (data.Item && data.Item.RESPONSE && data.Item.TTL.N > Math.floor((Date.now() / 1000))) {
                    resolve(data.Item.RESPONSE.S);
                }
                else {
                    resolve(null);
                }
            }
        });
    });
}

function putCache(responseObject) {
    return new Promise(function (resolve, reject) {
        let ddb = new aws.DynamoDB({apiVersion: '2012-08-10'});
        let expirationTime = Math.floor((Date.now() / 1000)) + parseInt(process.env['CACHE_TTL']);
        console.log('Cache expiration time: ' + expirationTime);
        let params = {
            TableName: "NMZL_US_API_CACHE",
            Item: {
                'CACHE_KEY': {
                    S: process.env['API_RESPONSE_CACHE_KEY']
                },
                'RESPONSE': {
                    S: JSON.stringify(responseObject)
                },
                'TTL': {
                    N: expirationTime.toString()
                }
            }
        };

        console.log('putCache: Putting response into DynamoDB table NMZL_US_API_CACHE');
        ddb.putItem(params, function (err) {
            if (err) {
                reject(Error('Error putting cache data from DynamoDB; Error info: ' + err));
            } else {
                resolve(responseObject);
            }
        });
    });
}