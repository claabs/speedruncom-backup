const got = require('got');
const fs = require('fs');
const path = require('path');

const GAME = 'mkw';
const OUTPUT_FOLDER = path.join('output', GAME);
const ASSET_FOLDER = path.join(OUTPUT_FOLDER, 'assets');
fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
fs.mkdirSync(ASSET_FOLDER, { recursive: true });

function writeToFile(urlString, data) {
    const url = new URL(urlString);
    const lastResource = path.basename(url.pathname);
    const outputPath = path.join(OUTPUT_FOLDER, `${lastResource}.json`);
    fs.writeFileSync(outputPath, data, 'utf8');
}

async function writeLinkToJson(url, paginate = true) {
    console.log('Writing all data from:', url);
    if (paginate) {
        const limit = 200;
        const existingParams = Object.fromEntries((new URL(url)).searchParams);
        const items = await got.paginate.all(url, {
            searchParams: {
                ...existingParams,
                max: limit,
                offset: 0
            },
            pagination: {
                transform: (response) => {
                    return JSON.parse(response.body).data;
                },
                paginate: (response, allItems, currentItems) => {
                    const previousSearchParams = response.request.options.searchParams;
                    const previousOffset = previousSearchParams.get('offset');

                    if (currentItems.length < limit) {
                        return false;
                    }

                    return {
                        searchParams: {
                            ...previousSearchParams,
                            offset: Number(previousOffset) + limit,
                        }
                    };
                }
            }
        });
        writeToFile(url, JSON.stringify(items));
    } else {
        const resp = await got.get(url);
        writeToFile(url, resp.body);
    }
}

async function saveAssets(assets) {
    const assetPromises = Object.entries(assets).map(async ([assetName, assetData]) => {
        if (!assetData) return;
        console.log('Writing image:', assetData.uri);
        const resp = await got.get(assetData.uri, { responseType: 'buffer' });
        const outputPath = path.join(ASSET_FOLDER, `${assetName}.png`);
        return fs.promises.writeFile(outputPath, resp.body);
    })
    await Promise.all(assetPromises);
}

async function main() {
    const gameUrl = `https://www.speedrun.com/api/v1/games/${GAME}`;
    console.log('Writing all data from:', gameUrl);
    const gameResp = await got.get(gameUrl, {
        responseType: 'json'
    });
    const gameId = gameResp.body.data.id; // l3dxogdy
    writeToFile(gameUrl, JSON.stringify(gameResp.body));
    await saveAssets(gameResp.body.data.assets);
    await writeLinkToJson(`https://www.speedrun.com/api/v1/games/${gameId}/categories`, false);
    await writeLinkToJson(`https://www.speedrun.com/api/v1/games/${gameId}/variables`, false);
    await writeLinkToJson(`https://www.speedrun.com/api/v1/games/${gameId}/levels`, false);
    await writeLinkToJson(`https://www.speedrun.com/api/v1/games/${gameId}/derived-games`, true);
    await writeLinkToJson(`https://www.speedrun.com/api/v1/games/${gameId}/records`, true);
    await writeLinkToJson(`https://www.speedrun.com/api/v1/runs?game=${gameId}`);
}

main();