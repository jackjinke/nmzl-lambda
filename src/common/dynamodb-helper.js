const aws = require('aws-sdk');

module.exports = {
    getCache, putCache,
    getPlayersInfo,
    getHeroImgMap, getAllHeroMetadata,
    getMatchDetails, putMatchDetails
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

function getPlayersInfo() {
    return new Promise(function (resolve, reject) {
        let ddb = new aws.DynamoDB({apiVersion: '2012-08-10'});
        let params = {
            TableName: "NMZL_US_PLAYERS"
        };

        console.log('getPlayersInfo: Scanning DynamoDB table NMZL_US_PLAYERS');
        ddb.scan(params, function (err, data) {
            if (err) {
                reject(Error('Error fetching players data from DynamoDB; Error info: ' + err));
            } else {
                resolve(data.Items);
            }
        });
    });
}

function getHeroImgMap(heroIdList) {
    return new Promise((resolve, reject) => {
        getHeroMetadata(heroIdList, 'id, img').then((response) => {
            let imagePrefix = 'https://cdn.dota2.com';
            let heroImgMap = {};
            Object.keys(response).forEach((heroId) => {
                heroImgMap[heroId] = imagePrefix + response[heroId].img.S;
            });
            resolve(heroImgMap);
        }).catch((error) => {
            reject(error);
        });
    });
}

function getHeroMetadata(heroIdList, projectionExpression) {
    let ddb = new aws.DynamoDB({apiVersion: '2012-08-10'});

    let requestMapList = heroIdList.map((heroId) => {
        return {'id': {N: heroId.toString()}}
    });

    let requestMapChuckList = [];
    while (requestMapList.length > 0) {
        requestMapChuckList.push(requestMapList.splice(0, 50));
    }

    let batchGetPromises = requestMapChuckList.map((requestMapList) => {
        let params = {
            RequestItems: {
                'DOTA2_HERO_INFO': {
                    Keys: requestMapList,
                    ProjectionExpression: projectionExpression
                }
            }
        };
        console.log(
            'getHeroMetadata: Batch getting item from DynamoDB table DOTA2_HERO_INFO,' +
            'projection expression: ' + projectionExpression
        );
        return new Promise((resolve, reject) => {
            ddb.batchGetItem(params, function (err, data) {
                if (err) {
                    reject(Error('Error fetching hero metadata from DynamoDB; Error info: ' + err));
                } else {
                    let heroInfoMap = {};
                    data.Responses.DOTA2_HERO_INFO.forEach((heroInfo) => {
                        heroInfoMap[heroInfo.id.N] = heroInfo;
                    });
                    resolve(heroInfoMap);
                }
            });
        });
    });
    return Promise.all(batchGetPromises).then((responses) => {
        return Object.assign({}, ...responses);
    });
}

function getAllHeroMetadata() {
    return new Promise(function (resolve, reject) {
        let ddb = new aws.DynamoDB({apiVersion: '2012-08-10'});
        let params = {
            TableName: "DOTA2_HERO_INFO"
        };

        console.log('getAllHeroMetadata: Scanning DynamoDB table DOTA2_HERO_INFO');
        ddb.scan(params, function (err, data) {
            if (err) {
                reject(Error('Error fetching hero metadata from DynamoDB; Error info: ' + err));
            } else {
                resolve(data.Items);
            }
        });
    });
}

function getMatchDetails(matchIdList) {
    let ddb = new aws.DynamoDB({apiVersion: '2012-08-10'});
    let requestMapList = matchIdList.map((matchId) => {
        return {'match_id': {N: matchId.toString()}}
    });

    let requestMapChuckList = [];
    while (requestMapList.length > 0) {
        requestMapChuckList.push(requestMapList.splice(0, 50));
    }

    let batchGetPromises = requestMapChuckList.map((requestMapList) => {
        let params = {
            RequestItems: {
                'NMZL_US_MATCHES': {
                    Keys: requestMapList,
                    ProjectionExpression: 'match_id, json'
                }
            }
        };

        console.log('getMatchDetails: Batch getting item from DynamoDB table NMZL_US_MATCHES');
        return new Promise((resolve, reject) => {
            ddb.batchGetItem(params, (err, data) => {
                if (err) {
                    reject(Error('Error fetching matches data from DynamoDB; Error info: ' + err));
                } else {
                    let matchDetailsMap = {};
                    data.Responses.NMZL_US_MATCHES.forEach((record) => {
                        matchDetailsMap[record.match_id.N] = record.json.S;
                    });
                    resolve(matchDetailsMap);
                }
            });
        });
    });

    return Promise.all(batchGetPromises).then((responses) => {
        return Object.assign({}, ...responses);
    });
}

function putMatchDetails(matchList) {
    let ddb = new aws.DynamoDB({apiVersion: '2012-08-10'});
    let putRequests = matchList.map((match) => {
        return {
            PutRequest: {
                Item: {
                    'match_id': {
                        N: match.match_id.toString()
                    },
                    'json': {
                        S: JSON.stringify(match)
                    }
                }
            }
        };
    });
    let putRequestChuckList = [];
    while (putRequests.length > 0) {
        putRequestChuckList.push(putRequests.splice(0, 25));
    }
    let batchWritePromises = putRequestChuckList.map((putRequestChuck) => {
        new Promise(function (resolve, reject) {
            let params = {
                RequestItems: {
                    'NMZL_US_MATCHES': putRequestChuck
                }
            };

            console.log('putMatchDetails: Batch writing item to DynamoDB table NMZL_US_MATCHES');
            ddb.batchWriteItem(params, (err) => {
                if (err) {
                    reject(Error('Error writing matches data to DynamoDB; Error info: ' + err));
                } else {
                    resolve();
                }
            });
        });
    });

    return Promise.all(batchWritePromises);
}