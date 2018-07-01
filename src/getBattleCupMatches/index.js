const dynamodbHelper = require('dynamodb-helper');
const matchesHelper = require('matches-helper');

exports.handler = (event, context, callback) => {
    dynamodbHelper.getCache().then((response) => {
        // Found valid cache
        if (response) {
            console.log('Found valid response cache, returning cache: ' + response);
            callback(null, JSON.parse(response));
            return;
        }

        // No valid cache found
        console.log('No valid cache found, generating new response');
        return dynamodbHelper.getPlayersInfo();
    }).then((responses) => {
        console.log('Got player info');
        let steamIdList = [];
        responses.forEach((playerInfo) => {
            playerInfo.STEAM_ID_LIST.L.forEach((steamIdObject) => {
                steamIdList.push(steamIdObject.N);
            });
        });
        let matchesListPromise = matchesHelper.getMatchesFromSteamIdList(steamIdList);
        let heroImgMapPromise = matchesListPromise.then((responses) => {
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
            return dynamodbHelper.getHeroImgs(heroIdList);
        });

        return Promise.all([matchesListPromise, heroImgMapPromise]);
    }).then(([matchesList, heroImgMap]) => {
        console.log('Got all hero img, adding img links into matches list');
        let matchesListWithImg = [];
        matchesList.forEach((matchInfo) => {
            matchInfo.radiant_lineup = matchInfo.radiant_lineup.map((heroId) => {
                return {'hero_id': heroId, 'hero_img': heroImgMap[heroId]}
            });
            matchInfo.dire_lineup = matchInfo.dire_lineup.map((heroId) => {
                return {'hero_id': heroId, 'hero_img': heroImgMap[heroId]}
            });

            matchesListWithImg.push(matchInfo);
        });

        console.log('Got all battle cup match details, putting cache and calling back with response: ' + JSON.stringify(matchesListWithImg));
        dynamodbHelper.putCache(matchesListWithImg).then(() => {
            callback(null, matchesListWithImg);
        }).catch((e) => {
            console.warn(e);
            callback(null, matchesListWithImg);
        });
    }).catch((error) => {
        callback(error)
    });
};

