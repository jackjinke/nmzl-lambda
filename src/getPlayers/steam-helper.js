const steamApiKey = process.env['STEAM_API_KEY'];
const steamApiUrl = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=' + steamApiKey;
const big = require('src/vendor/big');
const https = require('https');

module.exports = {getSteamListDetail};

function getSteamListDetail(steamIdList) {
    return new Promise((resolve, reject) => {
        let steamPromises = [];
        steamIdList.forEach(function (steamId) {
            steamPromises.push(getSteamInfo(steamId));
        });

        Promise.all(steamPromises).then(function (responses) {
            resolve(responses);
        }).catch(function (error) {
            reject(error);
        });
    });
}

function getSteamInfo(steamId) {
    let requestUrl = steamApiUrl + "&steamids=" + getSteamId64(steamId);
    return new Promise(function (resolve, reject) {
        console.log(`getSteamInfo: Sending request to ${requestUrl}`);
        https.get(requestUrl, function (res) {
            let rawData = '';
            res.on('data', (chunk) => {
                rawData += chunk;
            });
            res.on('end', () => {
                const parsedData = JSON.parse(rawData);
                const playerSteamAllDetail = parsedData.response.players[0];

                const playerSteamNeededDetail = {
                    steam_id: steamId,
                    steam_name: playerSteamAllDetail.personaname,
                    avatar: playerSteamAllDetail.avatarmedium,
                    state: playerSteamAllDetail.personastate ? (playerSteamAllDetail.gameid ? 2 : 1) : 0
                };

                resolve(playerSteamNeededDetail);
            });
        }).on('error', function (e) {
            console.error(`Problem with request: ${e.message}`);
            reject(e);
        });
    });
}

function getSteamId64(steamId) {
    // Magic number to transform 32-bit steam ID to 64-bit
    return new big.Big('76561197960265728').add(steamId).toString();
}