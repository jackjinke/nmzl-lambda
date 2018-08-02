const dynamodbHelper = require('dynamodb-helper');
const matchesHelper = require('battlecup-matches-helper');
const responseHelper = require('response-helper');

exports.handler = getBattleCupMatchesDeprecated;
exports.newHandler = getBattleCupMatches;

function getBattleCupMatchesDeprecated(event, context, callback) {
    dynamodbHelper.ApiCache.getCache().then((response) => {
        // Found valid cache
        if (response) {
            console.log('Found valid response cache, returning cache: ' + response);
            responseHelper.returnSuccess(JSON.parse(response), callback);
            return;
        }

        // No valid cache found
        console.log('No valid cache found, generating new response');
        return dynamodbHelper.Players.getPlayersInfo();
    }).then((responses) => {
        console.log('Got player info');
        let steamIdList = [];
        responses.forEach((playerInfo) => {
            playerInfo.STEAM_ID_LIST.forEach((steamId) => {
                steamIdList.push(steamId);
            });
        });
        let matchesListPromise = matchesHelper.getMatchesFromSteamIdList(steamIdList);
        let heroMetadataPromise = matchesListPromise.then((responses) => {
            console.log('Got all battle cup match details, adding hero image info');
            let heroIdList = [];
            responses.forEach((matchInfo) => {
                matchInfo.radiant_lineup.forEach((heroId) => {
                    if (!heroIdList.includes(heroId)) {
                        heroIdList.push(heroId);
                    }
                });
                matchInfo.dire_lineup.forEach((heroId) => {
                    if (!heroIdList.includes(heroId)) {
                        heroIdList.push(heroId);
                    }
                });
            });
            return dynamodbHelper.HeroMetadata.getHeroMetadata(heroIdList, ['img']);
        });
        return Promise.all([matchesListPromise, heroMetadataPromise]);
    }).then(([matchesList, heroMetadata]) => {
        console.log('Got all hero img, adding img links into matches list');
        let matchesListWithImg = [];
        matchesList.forEach((matchInfo) => {
            matchInfo.radiant_lineup = matchInfo.radiant_lineup.map((heroId) => {
                return {'hero_id': heroId, 'hero_img': heroMetadata[heroId].img}
            });
            matchInfo.dire_lineup = matchInfo.dire_lineup.map((heroId) => {
                return {'hero_id': heroId, 'hero_img': heroMetadata[heroId].img}
            });

            matchesListWithImg.push(matchInfo);
        });

        console.log('Got all battle cup match details, putting cache and calling back with response: ' + JSON.stringify(matchesListWithImg));
        dynamodbHelper.ApiCache.putCache(matchesListWithImg).then(() => {
            responseHelper.returnSuccess(matchesListWithImg, callback);
        }).catch((e) => {
            console.warn(e);
            responseHelper.returnSuccess(matchesListWithImg, callback);
        });
    }).catch((error) => {
        responseHelper.returnError(error, callback);
    });
}

function getBattleCupMatches(event, context, callback) {
    dynamodbHelper.ApiCache.getCache().then((response) => {
        // Found valid cache
        if (response) {
            console.log('Found valid response cache, returning cache: ' + response);
            responseHelper.returnSuccess(JSON.parse(response), callback);
            return;
        }

        // No valid cache found
        console.log('No valid cache found, generating new response');
        let matchesListPromise = dynamodbHelper.Matches.getBattleCupMatches();
        let heroMetadataPromise = matchesListPromise.then((responses) => {
            console.log('Got all battle cup match details, adding hero image info');
            let heroIdList = [];
            responses.forEach((matchInfo) => {
                matchInfo.radiant_lineup.forEach((heroId) => {
                    if (!heroIdList.includes(heroId)) {
                        heroIdList.push(heroId);
                    }
                });
                matchInfo.dire_lineup.forEach((heroId) => {
                    if (!heroIdList.includes(heroId)) {
                        heroIdList.push(heroId);
                    }
                });
            });
            return dynamodbHelper.HeroMetadata.getHeroMetadata(heroIdList, ['img']);
        });
        return Promise.all([matchesListPromise, heroMetadataPromise]);
    }).then(([matchesList, heroMetadata]) => {
        console.log('Got all hero img, adding img links into matches list');
        let matchesListWithImg = [];
        matchesList.forEach((matchInfo) => {
            matchInfo.radiant_lineup = matchInfo.radiant_lineup.map((heroId) => {
                return {'hero_id': heroId, 'hero_img': heroMetadata[heroId].img}
            });
            matchInfo.dire_lineup = matchInfo.dire_lineup.map((heroId) => {
                return {'hero_id': heroId, 'hero_img': heroMetadata[heroId].img}
            });

            matchesListWithImg.push(matchInfo);
        });

        console.log('Got all battle cup match details, putting cache and calling back with response: ' + JSON.stringify(matchesListWithImg));
        dynamodbHelper.ApiCache.putCache(matchesListWithImg).then(() => {
            responseHelper.returnSuccess(matchesListWithImg, callback);
        }).catch((e) => {
            console.warn(e);
            responseHelper.returnSuccess(matchesListWithImg, callback);
        });
    }).catch((error) => {
        responseHelper.returnError(error, callback);
    });
}