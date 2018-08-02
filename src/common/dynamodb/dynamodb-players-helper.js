const aws = require('aws-sdk');

module.exports = {
    getPlayersInfo
};

function getPlayersInfo() {
    return new Promise(function (resolve, reject) {
        let ddb = new aws.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
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