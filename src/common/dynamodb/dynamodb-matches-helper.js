const aws = require('aws-sdk');

module.exports = {
    getMatchDetails, putMatchDetails
};

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