const https = require('https');
const dynamodbHelper = require('dynamodb-helper');
const refreshAllMatchIds = require('refresh-all-match-ids');
const openDotaApiKey = process.env['OPENDOTA_API_KEY'];
const teamPlayerCountThreshold = parseInt(process.env['TEAM_PLAYER_COUNT_THRESHOLD']);
const allMatchIdCacheKey = process.env['ALL_MATCH_ID_CACHE_KEY'];
const allMatchIdCacheTTL = process.env['ALL_MATCH_ID_CACHE_TTL'];

exports.handler = async (event, context) => {
    try {
        let playersInfo = await dynamodbHelper.Players.getPlayersInfo();
        console.log('Got players info');
        let steamIdList = [];
        playersInfo.forEach((playerInfo) => {
            playerInfo.STEAM_ID_LIST.forEach((steamId) => {
                if (!steamIdList.includes(steamId)) {
                    steamIdList.push(steamId);
                }
            });
        });
        let matchLists = await Promise.all(steamIdList.map(getAllMatchesForPlayerFromOpendota));
        console.log('Got all matches lists');
        // Calculate team player count in matches
        let matchMap = {};
        matchLists.forEach((matchListObject) => {
            let steamId = matchListObject.steamId;
            let matchList = matchListObject.matchList;
            matchList.forEach((match) => {
                if (matchMap[match.match_id]) {
                    matchMap[match.match_id].team_player_list.push(steamId);
                } else {
                    matchMap[match.match_id] = {
                        team_win: isMatchWin(match),
                        team_side: getTeamSide(match),
                        team_player_list: [steamId]
                    };
                };
            });
        });

        // Filter team matches
        Object.keys(matchMap).forEach((matchId) => {
            if (matchMap[matchId].team_player_list.length < teamPlayerCountThreshold) {
                matchMap[matchId] = undefined;
            }
        });

        console.warn('Getting all match id cache');
        let allMatchIdCache = await dynamodbHelper.ApiCache.getCache(allMatchIdCacheKey);
        let existingMatchIdList = [];
        if (allMatchIdCache === null) {
            console.warn('All match id cache not found, getting existing match id now');
            existingMatchIdList = await refreshAllMatchIds.handler({overrideKey: allMatchIdCacheKey, overrideTTL: allMatchIdCacheTTL});
        } else {
            existingMatchIdList = JSON.parse(allMatchIdCache);
        }

        console.log('Found ' + existingMatchIdList.length + ' existing matches: ' + existingMatchIdList);
        existingMatchIdList.forEach((matchId) => {
            matchMap[matchId] = undefined;
        });
        // Use stringfy then parse to clean up undefined values
        let loadedMatchIdList = await loadMatchDetails(JSON.parse(JSON.stringify(matchMap)));
        console.log('Successfully loaded all new matches: ' + loadedMatchIdList);
        let allMatchIdList = existingMatchIdList.concat(loadedMatchIdList);
        console.warn('Updating all match id cache');
        return await dynamodbHelper.ApiCache.putCache(allMatchIdList, allMatchIdCacheKey, allMatchIdCacheTTL);
    } catch (error) {
        console.error(error);
        return error;
    }
};

async function getAllMatchesForPlayerFromOpendota(steamId) {
    let requestUrl = 'https://api.opendota.com/api/players/' + steamId + '/matches?api_key=' + openDotaApiKey;
    console.log('Getting match data for Steam account ' + steamId);
    return new Promise((resolve, reject) => {
        https.get(requestUrl, (res) => {
            let error;
            const contentType = res.headers['content-type'];
            if (res.statusCode !== 200) {
                error = new Error(`API call for getting player matches data of Steam account ${steamId} has failed; request error code: ${res.statusCode}`);
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
                resolve({
                    steamId: steamId,
                    matchList: parsedData
                });
            });
        }).on('error', (e) => {
            console.error(`Problem with refresh player matches request: ${e.message}`);
            reject(e);
        }).end();
    });
}

async function loadMatchDetails(matchesMap) {
    let matchIdList = Object.keys(matchesMap);
    console.log('Loading new matches into DynamoDB: ' + matchIdList);
    let matchIdChunkList = [];
    while (matchIdList.length > 0) {
        matchIdChunkList.push(matchIdList.splice(0, 25));
    }

    var loadedMatchId = [];
    for (let matchIdChunk of matchIdChunkList) {
        let loadedMatchIdList = await loadMatchDetailsChunk(matchIdChunk, matchesMap);
        console.log('Successfully loaded chunk of matches: ' + loadedMatchIdList);
        loadedMatchId = loadedMatchId.concat(loadedMatchIdList);
    }

    return loadedMatchId;
}

async function loadMatchDetailsChunk(matchIdChunk, matchesMap) {
    let matchDetailsList = await Promise.all(matchIdChunk.map(async (matchId) => {
        try {
            let matchDetails = removeUnnecessaryData(await getSingleMatchDetailsFromOpenDota(matchId));
            return Object.assign(matchDetails, matchesMap[matchId]);
        } catch (err) {
            console.warn(err);
            return null;
        }
    }));
    console.log('Writing chunk of new match details to DynamoDB');
    return await dynamodbHelper.Matches.putMatchDetails(matchDetailsList);
}

async function getSingleMatchDetailsFromOpenDota(matchId) {
    let requestUrl = 'https://api.opendota.com/api/matches/' + matchId + '?api_key=' + openDotaApiKey;
    return new Promise((resolve, reject) => {
        https.get(requestUrl, (res) => {
            let error;
            const contentType = res.headers['content-type'];
            if (res.statusCode !== 200) {
                error = new Error(`API call for retrieving match ${matchId} has failed; request error code: ${res.statusCode}`);
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
                console.log('Got match detail from OpenDota API, match ID: ' + matchId);
                resolve(parsedData);
            });
        }).on('error', (e) => {
            console.error(`Problem with getSingleMatchDetailsFromOpenDota request: ${e.message}`);
            reject(e);
        });
    });
}

// Set unneccessary fields to undefinied, reduce item size
function removeUnnecessaryData(match) {
    match.cosmetics = undefined;
    match.my_word_counts = undefined;
    match.negative_votes = undefined;
    match.players.forEach((player) => {
        player.cosmetics = undefined;
    });

    return match;
}

function isMatchWin(match) {
    return getTeamSide(match) === 'radiant' ? match.radiant_win : !match.radiant_win;
}

function getTeamSide(match) {
    return (match.player_slot < 128) ? 'radiant' : 'dire';
}