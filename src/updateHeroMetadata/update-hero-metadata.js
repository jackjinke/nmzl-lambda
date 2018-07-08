const https = require('https');
const dynamodbHelper = require('dynamodb-helper');
const openDotaApiKey = process.env['OPENDOTA_API_KEY'];

exports.handler = (event, context, callback) => {
    let requestUrl = "https://api.opendota.com/api/heroStats&api_key=" + openDotaApiKey;
    new Promise((resolve, reject) => {
        console.log('Getting hero stats data from OpenDota');
        https.get(requestUrl, (res) => {
            let error;
            const contentType = res.headers['content-type'];
            if (res.statusCode !== 200) {
                error = new Error(`API call for retrieving hero stats has failed; request error code: ${res.statusCode}`);
            }
            else if (!/^application\/json/.test(contentType)) {
                error = new Error(`Invalid content-type, expecting application/json but received ${contentType}`);
            }
            if (error) {
                console.error(error);
                reject(error);
            }

            let rawData = '';
            res.on('data', (chunk) => {
                rawData += chunk;
            });
            res.on('end', () => {
                const parsedData = JSON.parse(rawData);
                resolve(parsedData);
            });
        }).on('error', (e) => {
            console.error(`Problem with getHeroStats request: ${e.message}`);
            reject(e);
        });
    }).then((response) => {
        console.log('Got hero stats data from OpenDota, calculating winrate map');
        let heroMetadataObjectList = response.map((heroStat) => {
            let winRate = {};
            Object.keys(heroStat).filter((key) => /.*_pick$/.test(key)).forEach((pickKey) => {
                let winKey = pickKey.split('_pick')[0] + '_win';
                if (heroStat[pickKey] === 0) {
                    winRate[winKey] = {N: '0'};
                }
                else {
                    winRate[winKey] = {
                        N: (heroStat[winKey] / heroStat[pickKey]).toFixed(4).toString()
                    };
                }
            });
            console.log(
                'Got winrate map for hero id:' +
                heroStat.id +
                ', winrate map: ' +
                JSON.stringify(winRate)
            );
            return {
                id: {N: heroStat.id.toString()},
                localized_name: {S: heroStat.localized_name},
                name: {S: heroStat.name},
                img: {S: heroStat.img},
                icon: {S: heroStat.icon},
                winrate: {M: winRate},
                json: {S: JSON.stringify(heroStat)}
            }
        });
        return dynamodbHelper.HeroMetadata.putHeroMetadata(heroMetadataObjectList);
    }).then(() => {
        console.log('Successfully updated hero metadata');
        callback(null);
    }).catch((error) => {
        callback(error);
    });
};