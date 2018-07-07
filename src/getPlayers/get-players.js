const dynamodbHelper = require('dynamodb-helper');
const responseHelper = require('response-helper');
const steamHelper = require('steam-helper');
const signatureHeroesHelper = require('signature-heroes-helper');

exports.handler = (event, context, callback) => {
    dynamodbHelper.ApiCache.getCache().then((response) => {
        // Found valid cache
        if (response) {
            console.log('Found valid response cache, returning cache: ' + response);
            responseHelper.returnSuccess(JSON.parse(response), callback);
            return;
        }

        // No valid cache found
        console.log('No valid cache found, generating new response');
        let playerDetailsPromise = dynamodbHelper.Players.getPlayersInfo().then((responses) => {
            console.log('Got player info');
            let playerDetailPromises = [];
            responses.forEach(playerInfo => {
                playerDetailPromises.push(getPlayersDetail(playerInfo));
            });
            return Promise.all(playerDetailPromises);
        });

        let heroMetadataPromise = playerDetailsPromise.then((responses) => {
            console.log('Got hero img links');
            let heroIdList = [];
            responses.forEach((playerInfo) => {
                playerInfo.signature_heroes.forEach((signatureHero) => {
                    if (!heroIdList.includes(signatureHero.hero_id)) {
                        heroIdList.push(signatureHero.hero_id);
                    }
                });
            });
            return dynamodbHelper.HeroMetadata.getHeroMetadata(heroIdList, ['img']);
        });
        return Promise.all([playerDetailsPromise, heroMetadataPromise])
    }).then(([playerDetails, heroMetadata]) => {
        console.log('Adding hero img links into player details');
        playerDetails.map((playerInfo) => {
            playerInfo.signature_heroes.forEach((signatureHero, signatureHeroIndex, signatureHeroArray) => {
                signatureHeroArray[signatureHeroIndex].hero_img = heroMetadata[signatureHero.hero_id].img.S;
            });
            return playerInfo;
        });
        console.log('Added hero img links, putting cache and calling back with final response object: ' + JSON.stringify(playerDetails));

        // No Promise's finally() support in Node.js yet
        dynamodbHelper.ApiCache.putCache(playerDetails).then(() => {
            responseHelper.returnSuccess(playerDetails, callback);
        }).catch((e) => {
            console.warn(e);
            responseHelper.returnSuccess(playerDetails, callback);
        });
    }).catch((error) => {
        responseHelper.returnError(error, callback);
    });
};

function getPlayersDetail(playerInfo) {
    return new Promise((resolve, reject) => {
        let playersDetail = {
            player_name: playerInfo.PLAYER_NAME.S
        };
        let steamIdList = playerInfo.STEAM_ID_LIST.L.map((steamIdObject) => steamIdObject.N);

        steamHelper.getSteamListDetail(steamIdList).then(steamIdDetails => {
            playersDetail.steam_accounts = steamIdDetails;
            return signatureHeroesHelper.getSignatureHeroes(steamIdDetails.map(steamIdDetail => steamIdDetail.steam_id));
        }).then(sigHeroes => {
            playersDetail.signature_heroes = sigHeroes;
            resolve(playersDetail);
        }).catch(function (error) {
            reject(error);
        });
    });
}