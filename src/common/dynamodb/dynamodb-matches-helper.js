const aws = require('aws-sdk');

module.exports = {
    getMatchDetails, putMatchDetails, getBattleCupMatches
};

function getMatchDetails(matchIdList) {
    let ddb = new aws.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
    let requestMapList = matchIdList.map((matchId) => {
        return {'match_id': matchId}
    });

    let requestMapChuckList = [];
    while (requestMapList.length > 0) {
        requestMapChuckList.push(requestMapList.splice(0, 50));
    }

    let batchGetPromises = requestMapChuckList.map((requestMapList) => {
        let params = {
            RequestItems: {
                'NMZL_US_MATCHES': {
                    Keys: requestMapList
                }
            }
        };

        console.log('getMatchDetails: Batch getting item from DynamoDB table NMZL_US_MATCHES');
        return new Promise((resolve, reject) => {
            ddb.batchGet(params, (err, data) => {
                if (err) {
                    reject(Error('Error fetching match(es) data from DynamoDB; Error info: ' + err));
                } else {
                    let matchDetailsMap = {};
                    data.Responses.NMZL_US_MATCHES.forEach((record) => {
                        matchDetailsMap[record.match_id] = record;
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
    let ddb = new aws.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
    let putRequests = matchList.map((match) => {
        return {
            PutRequest: {
                Item: match
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
                    'NMZL_US_MATCHES': putRequestChuck
                }
            };

            console.log('putMatchDetails: Batch writing item(s) to DynamoDB table NMZL_US_MATCHES');
            ddb.batchWrite(params, (err) => {
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

function getBattleCupMatches() {
    let ddb = new aws.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
    let params = {
        TableName: 'NMZL_US_MATCHES',
        IndexName: 'INDEX_LOBBY_TYPE',
        KeyConditionExpression: 'lobby_type = :lobby_type',
        ExpressionAttributeValues: {
            ':lobby_type': 9
        },
        ScanIndexForward: false
      };

    console.log('getBattleCupMatches: Querying battle cup match(es) from DynamoDB table NMZL_US_MATCHES');
    return new Promise((resolve, reject) => {
        ddb.query(params, (err, data) => {
            if (err) {
                reject(Error('Error querying battle cup match(es) data from DynamoDB; Error info: ' + err));
            } else {
                resolve(data.Items);
            }
        });
    });
}