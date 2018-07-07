const https = require('https');
const dynamodbHelper = require('dynamodb-helper');
const openDotaApiKey = process.env['OPENDOTA_API_KEY'];

module.exports = {getMatchesFromSteamIdList};

function getMatchesFromSteamIdList(steamIdList) {
    return new Promise((resolve, reject) => {
        let matchPromises = [];
        steamIdList.forEach((steamId) => {
            matchPromises.push(getMatchesFromSteamId(steamId));
        });
        let matchesDict = {};
        Promise.all(matchPromises).then((responses) => {
            responses.forEach((matches) => {
                matches.forEach((match) => {
                    if (!matchesDict[match.match_id]) {
                        matchesDict[match.match_id] = match;
                        matchesDict[match.match_id].player_count = 1;
                    }
                    else {
                        matchesDict[match.match_id].player_count += 1;
                    }
                });
            });
            let matches = [];
            let matchesDictKeyList = Object.keys(matchesDict);
            matchesDictKeyList.forEach((match_id) => {
                if (matchesDict[match_id].player_count >= parseInt(process.env['BATTLE_CUP_TEAM_PLAYER_COUNT_THRESHOLD'])) {
                    matches.push(matchesDict[match_id]);
                }
            });
            return getMatchDetails(matches);
        }).then((response) => {
            console.log('Sorting matches by match ID');
            response.sort((a, b) => b.match_id - a.match_id);

            console.log('Returning with matches list');
            resolve(response);
        }).catch((error) => {
            reject(error);
        });
    });
}

function getMatchesFromSteamId(steamId) {
    return new Promise((resolve, reject) => {
        getRawMatchesFromSteamId(steamId).then((rawMatches) => {
            let matches = [];
            rawMatches.forEach((rawMatch) => {
                let match = {};
                match.match_id = rawMatch.match_id;
                match.win = isMatchWin(rawMatch);
                match.team_side = getTeamSide(rawMatch);
                match.lobby_type = rawMatch.lobby_type;
                matches.push(match);
            });
            resolve(matches);
        }).catch((error) => {
            reject(error);
        })
    });
}

function getRawMatchesFromSteamId(steamId) {
    let requestUrl = 'https://api.opendota.com/api/players/' + steamId + '/matches?lobby_type=9&api_key=' + openDotaApiKey;
    return new Promise((resolve, reject) => {
        console.log('Sending request: ' + requestUrl);
        https.get(requestUrl, (res) => {
            let error;
            const contentType = res.headers['content-type'];
            if (res.statusCode !== 200) {
                error = new Error(`API call for retrieving battle cup matches data of Steam account ${steamId} has failed; request error code: ${res.statusCode}`);
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
                console.log('Got match list from OpenDota API, steam ID: ' + steamId);
                resolve(parsedData);
            });
        }).on('error', (e) => {
            console.error(`Problem with getRawMatchesFromSteamId request: ${e.message}`);
            reject(e);
        });
    });
}

function getMatchDetails(matchList) {
    return new Promise((resolve, reject) => {
        let matchIdList = matchList.map((match) => match.match_id);
        dynamodbHelper.Matches.getMatchDetails(matchIdList).then((responses) => {
            console.log('Got response from DynamoDB BatchGet');
            console.log(JSON.stringify(responses));
            let matchesFromDynamoDB = [];
            let promises = [];
            matchList.forEach((match) => {
                if (Object.keys(responses).includes(match.match_id.toString())) {
                    console.log('Found match ' + match.match_id + ' in DynamoDB');
                    matchesFromDynamoDB.push(JSON.parse(responses[match.match_id]));
                }
                else {
                    console.log('Did not found match ' + match.match_id + ' in DynamoDB, will call OpenDota API');
                    promises.push(getSingleMatchDetailsFromOpenDota(match));
                }
            });
            Promise.all(promises).then((matchesFromOpenDota) => {
                if (matchesFromOpenDota.length > 0) {
                    // Record these new match details to DynamoDB
                    console.log('Putting responses from OpenDota into DynamoDB');
                    dynamodbHelper.Matches.putMatchDetails(matchesFromOpenDota).catch((error) => {
                        console.warn('Unable to put matches data into DynamoDB, error: ' + error);
                    });
                }

                console.log('Returning match details');
                resolve(matchesFromDynamoDB.concat(matchesFromOpenDota));
            }).catch((error) => {
                console.error('Unable to get matches data from OpenDota');
                reject(error);
            });
        }).catch((error) => {
            console.error('Unable to get matches data from DynamoDB');
            reject(error);
        });
    });
}

function getSingleMatchDetailsFromOpenDota(match) {
    let requestUrl = 'https://api.opendota.com/api/matches/' + match.match_id + '?api_key=' + openDotaApiKey;
    return new Promise((resolve, reject) => {
        console.log('Sending request: ' + requestUrl);
        https.get(requestUrl, (res) => {
            let error;
            const contentType = res.headers['content-type'];
            if (res.statusCode !== 200) {
                error = new Error(`API call for retrieving battle cup matches data of match id ${match.match_id} has failed; request error code: ${res.statusCode}`);
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
                match.start_time = parsedData.start_time;
                match.duration = parsedData.duration;
                match.radiant_score = (parsedData.radiant_score) ? parsedData.radiant_score : "N/A";
                match.dire_score = (parsedData.dire_score) ? parsedData.dire_score : "N/A";

                match.radiant_lineup = parsedData.players.slice(0, 5).map((playerInfo) =>  playerInfo.hero_id);
                match.dire_lineup = parsedData.players.slice(5, 10).map((playerInfo) => playerInfo.hero_id);
                console.log('Got match detail from OpenDota API, match ID: ' + match.match_id);
                resolve(match);
            });
        }).on('error', (e) => {
            console.error(`Problem with getSingleMatchDetailsFromOpenDota request: ${e.message}`);
            reject(e);
        });
    });
}

function isMatchWin(match) {
    return getTeamSide(match) === 'radiant' ? match.radiant_win : !match.radiant_win;
}

function getTeamSide(match) {
    return (match.player_slot < 128) ? 'radiant' : 'dire';
}