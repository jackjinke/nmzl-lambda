const https = require('https');
const openDotaApiKey = process.env['OPENDOTA_API_KEY'];

module.exports = {getSignatureHeroes};

function getSignatureHeroes(steamIds) {
    return new Promise((resolve, reject) => {
        // Get recent matches
        let promises = [];
        steamIds.forEach(steamId => {
                promises.push(getRecentMatchesOnAccount(steamId));
            }
        );
        Promise.all(promises).then(function (responses) {
            let recentMatches = [];
            responses.forEach(function (response) {
                recentMatches = recentMatches.concat(response);
            });

            recentMatches.sort(function (a, b) {
                return b.match_id - a.match_id;
            });
            recentMatches = recentMatches.slice(0, parseInt(process.env['MATCH_LIMIT']));

            // Get hero data from recent matches
            let heroData = [];
            recentMatches.forEach(function (match) {
                // Get match result, 1 = win
                let winResult = isMatchWin(match);
                let heroDataIndex = heroData.findIndex(heroData => heroData.hero_id === match.hero_id);
                if (heroDataIndex === -1) {
                    heroData.push({
                        hero_id: match.hero_id,
                        win: winResult,
                        games: 1
                    });
                }
                else {
                    heroData[heroDataIndex].win += winResult;
                    heroData[heroDataIndex].games += 1;
                }
            });
            heroData.forEach(function (hero) {
                if (hero.games < parseInt(process.env['HERO_COUNT_THRESHOLD'])) {
                    hero.win_rate = 0;
                }
                else {
                    hero.win_rate = (hero.win / hero.games).toFixed(5);
                }
            });

            heroData = heroData.filter(hero => hero.win_rate > 0);
            heroData.sort(function (a, b) {
                if (a.games === b.games) {
                    return b.win_rate - a.win_rate;
                }
                return b.games - a.games;
            });
            heroData = heroData.slice(0, 3);
            resolve(heroData);
        }).catch(err => {
            // error occurred
            reject(`Error occurred for retrieving heroes data of Steam accounts: ${JSON.stringify(steamIds)}; Error message: + ${err.toString()}`);
        });
    });
}

function getRecentMatchesOnAccount(steamId) {
    let requestUrl = "https://api.opendota.com/api/players/" + steamId + "/matches?limit=" + process.env['MATCH_LIMIT'] + "&significant=1&api_key=" + openDotaApiKey;
    return new Promise((resolve, reject) => {
        console.log(`getRecentMatchesOnAccount: Sending request to ${requestUrl}`);
        https.get(requestUrl, (res) => {
            let error;
            const contentType = res.headers['content-type'];
            if (res.statusCode !== 200) {
                error = new Error(`API call for retrieving matches data of Steam account ${steamId} has failed; request error code: ${res.statusCode}`);
            } else if (!/^application\/json/.test(contentType)) {
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
            console.error(`Problem with getRecentMatchesOnAccount request: ${e.message}`);
            reject(e);
        });
    });
}

function isMatchWin(match) {
    return (match.player_slot < 128 ? match.radiant_win : !match.radiant_win) ? 1 : 0;
}