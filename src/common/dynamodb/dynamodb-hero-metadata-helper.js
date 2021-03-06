const aws = require('aws-sdk');

module.exports = {
    getHeroMetadata, getAllHeroMetadata, putHeroMetadata
};

function getHeroMetadata(heroIdList, projectionExpression = []) {
    let ddb = new aws.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});

    let requestMapList = heroIdList.map((heroId) => {
        return {'id': heroId}
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
                    ProjectionExpression: projectionExpression.length === 0 ? undefined : ['id', ...projectionExpression].join(', ')
                }
            }
        };
        console.log(
            'getHeroMetadata: Batch getting item(s) from DynamoDB table DOTA2_HERO_INFO,' +
            'projection expression: ' + projectionExpression
        );
        return new Promise((resolve, reject) => {
            ddb.batchGet(params, function (err, data) {
                if (err) {
                    reject(Error('Error fetching hero metadata from DynamoDB; Error info: ' + err));
                } else {
                    let heroInfoMap = {};
                    data.Responses.DOTA2_HERO_INFO.forEach((heroInfo) => {
                        heroInfoMap[heroInfo.id] = heroInfo;
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
        let ddb = new aws.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
        let params = {
            TableName: "DOTA2_HERO_INFO"
        };

        console.log('getAllHeroMetadata: Scanning DynamoDB table DOTA2_HERO_INFO');
        ddb.scan(params, function (err, data) {
            if (err) {
                reject(Error('Error fetching hero metadata from DynamoDB; Error info: ' + err));
            } else {
                let heroInfoMap = {};
                data.Items.forEach((heroInfo) => {
                    heroInfoMap[heroInfo.id] = heroInfo;
                });
                resolve(heroInfoMap);
            }
        });
    });
}

function putHeroMetadata(heroMetadataList) {
    let ddb = new aws.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
    let putRequests = heroMetadataList.map((heroMetadata) => {
        return {
            PutRequest: {
                Item: heroMetadata
            }
        };
    });
    let putRequestChuckList = [];
    while (putRequests.length > 0) {
        putRequestChuckList.push(putRequests.splice(0, 25));
    }
    let batchWritePromises = putRequestChuckList.map((putRequestChuck) => {
        return new Promise(function (resolve, reject) {
            let params = {
                RequestItems: {
                    'DOTA2_HERO_INFO': putRequestChuck
                }
            };

            console.log('putHeroMetadata: Batch writing item(s) to DynamoDB table DOTA2_HERO_INFO');
            ddb.batchWrite(params, (err) => {
                if (err) {
                    reject(Error('Error writing match(es) data to DynamoDB; Error info: ' + err));
                } else {
                    resolve();
                }
            });
        });
    });

    return Promise.all(batchWritePromises);
}