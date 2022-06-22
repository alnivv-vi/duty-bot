const googleDocService = require('./google-doc.js');
const {App} = require('@slack/bolt');
require('dotenv').config();

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

app.command('/duty', async ({command, ack, say}) => {
    await ack();

    try {
        const dutyName = googleDocService.getActualDutyName();
        const dutySlackId = googleDocService.getActualDutyId();
        await say(`Дежурит ${dutyName}. <@${dutySlackId}>, help!`);
    } catch (e) {
        console.error(e)
    }

});


(async () => {
    await googleDocService.start();
    await app.start(process.env.PORT || 3000);

    console.log('⚡️duty-bot готов к работе ⚡');
})();