const https = require('https');
const dynamodbHelper = require('dynamodb-helper');
const openDotaApiKey = process.env['OPENDOTA_API_KEY'];

exports.handler = (event, context, callback) => {
    dynamodbHelper.getPlayersInfo().then((playersInfo) => {
        let steamIdList = [];
        playersInfo.forEach((playerInfo) => {
            playerInfo.STEAM_ID_LIST.forEach((steamId) => {
                if (!steamIdList.includes(steamId)) {
                    steamIdList.push(steamId);
                }
            });
        });
        let refreshPromiseList = steamIdList.map((steamId) => {
            return new Promise((resolve, reject) => {
                let options = {
                    hostname: 'api.opendota.com',
                    port: 443,
                    path: '/api/players/' + steamId + '/refresh?api_key=' + openDotaApiKey,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                };
                console.log('Refreshing match data for Steam account ' + steamId);
                https.request(options, (res) => {
                    let error;
                    if (res.statusCode !== 200) {
                        error = new Error(`API call for refreshing player matches data of Steam account ${steamId} has failed; request error code: ${res.statusCode}`);
                        console.error(error);
                        reject(error);
                    }
                    res.on('end', () => {
                        console.log('Successfully refreshed matches data on account ' + steamId);
                        resolve();
                    });
                }).on('error', (e) => {
                    console.error(`Problem with refresh player matches request: ${e.message}`);
                    reject(e);
                }).end();
            })
        });
        return Promise.all(refreshPromiseList);
    }).then(() => {
        callback(null);
    }).catch((error) => {
        console.error(error);
        callback(error);
    });
};