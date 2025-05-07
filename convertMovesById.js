const fs = require('fs');
const {Game} = require("./src/game/game");

function main() {
    const movesById = JSON.parse(fs.readFileSync('./moves_by_id.json', 'utf8'));
    const notationsHistoryById = {};
    let count = 0;
    for (const id of Object.keys(movesById)) {
        count++;
        if (count % 100 === 0) {
            console.log(`Parsed ${count} files`);
        }
        const moves = movesById[id];
        try {
            const notationsHistory = Game.Classic.convertJsonMovesToNotationsHistory(moves);
            notationsHistoryById[id] = notationsHistory;
        } catch (e) {
            console.error(`${count}: Could not apply moves for '${id}': ${e}`);
        }
    }
    fs.writeFileSync("./notations_history_by_id.json", JSON.stringify(notationsHistoryById));
}

main();
