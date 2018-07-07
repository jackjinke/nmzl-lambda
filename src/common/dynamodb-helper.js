const aws = require('aws-sdk');

module.exports = {
    getCache: () => {
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
    },

    putCache: (responseObject) => {
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
    },

    getPlayersInfo: () => {
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
    },

    getHeroImgs: (heroIdList) => {
        let imagePrefix = 'https://api.opendota.com';
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
                        ProjectionExpression: 'id, img'
                    }
                }
            };
            console.log('getHeroImg: Batch getting item from DynamoDB table DOTA2_HERO_INFO');
            return new Promise((resolve, reject) => {
                ddb.batchGetItem(params, function (err, data) {
                    if (err) {
                        reject(Error('Error fetching hero image from DynamoDB; Error info: ' + err));
                    } else {
                        let heroImgMap = {};
                        data.Responses.DOTA2_HERO_INFO.forEach((heroInfo) => {
                            heroImgMap[heroInfo.id.N] = imagePrefix + heroInfo.img.S;
                        });
                        resolve(heroImgMap);
                    }
                });
            });
        });
        return Promise.all(batchGetPromises).then((responses) => {
            return Object.assign({}, ...responses);
        });
    },

    getMatchDetails(matchIdList) {
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
    },

    putMatchDetails(matchList) {
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

};